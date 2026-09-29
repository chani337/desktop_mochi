#!/usr/bin/env python3
"""Validate and publish one complete update release; never upload signing keys."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REPO = 'chani337/desktop_mochi'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

def validate(version):
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Expected stable x.y.z version')
    package = json.loads((ROOT / 'windows/mochi-desktop/package.json').read_text())
    info = plistlib.loads((ROOT / 'macos/DesktopCat/Info.plist').read_bytes())
    assert version == package['version'] == info['CFBundleShortVersionString']
    folder = ROOT / 'release' / ('v' + version)
    files = [folder / 'mac/DesktopCat.zip', folder / 'mac/appcast.xml', folder / 'latest.yml',
             folder / f'Mochi-Setup-{version}.exe', folder / f'Mochi-Setup-{version}.exe.blockmap',
             folder / f'Mochi-{version}-win-x64.zip']
    assert all(p.is_file() and p.stat().st_size > 0 for p in files), 'Missing release assets'
    feed = ET.parse(files[1])
    ns = '{http://www.andymatuschak.org/xml-namespaces/sparkle}'
    item = feed.find('channel/item')
    assert item.findtext(ns + 'shortVersionString') == version
    assert item.findtext(ns + 'version') == info['CFBundleVersion']
    enclosure = item.find('enclosure')
    assert enclosure.attrib['url'] == f'https://github.com/{REPO}/releases/download/v{version}/DesktopCat.zip'
    assert int(enclosure.attrib['length']) == files[0].stat().st_size
    signer = ROOT / 'macos/DesktopCat/Vendor/Sparkle/bin/sign_update'
    key_args = ['--ed-key-file', os.environ['SPARKLE_ED_KEY_FILE']] if os.environ.get('SPARKLE_ED_KEY_FILE') else ['--account', 'desktop-mochi']
    subprocess.run([str(signer), *key_args, '--verify', str(files[0]), enclosure.attrib[ns + 'edSignature']], check=True)
    subprocess.run([str(signer), *key_args, '--verify', str(files[1])], check=True)
    metadata = subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('js-yaml').load(require('fs').readFileSync(process.argv[1],'utf8'))))", str(files[2])], cwd=ROOT / 'windows/mochi-desktop', text=True)
    meta = json.loads(metadata)
    assert meta['version'] == version
    for record in meta['files']:
        target = folder / record['url']
        assert target.parent == folder and target in files
        assert base64.b64encode(hashlib.sha512(target.read_bytes()).digest()).decode() == record['sha512']
        assert target.stat().st_size == record['size']
    return files

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('version')
    parser.add_argument('--notes', type=Path, required=True)
    parser.add_argument('--publish', action='store_true', help='Upload and publish after validation')
    args = parser.parse_args()
    files = validate(args.version)
    print('Release signatures, metadata and hashes verified.', flush=True)
    if not args.publish:
        return
    assert not git('status', '--porcelain'), 'Commit changes before publishing'
    head = git('rev-parse', 'HEAD')
    assert git('ls-remote', 'origin', 'refs/heads/main').split()[0] == head, 'Push main first'
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        credentials = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', text=True, capture_output=True, timeout=15, cwd=ROOT, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
        token = dict(line.split('=', 1) for line in credentials.stdout.splitlines() if '=' in line).get('password')
    if not token:
        raise RuntimeError('GitHub authentication is required')
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'Mochi-release'}
    def request(url, data=None, method=None, content_type='application/json'):
        req = urllib.request.Request(url, data=data, method=method, headers={**headers, 'Content-Type': content_type})
        with urllib.request.urlopen(req, timeout=300) as response:
            return json.load(response)
    base = f'https://api.github.com/repos/{REPO}'
    try:
        release = request(base + '/releases/tags/v' + args.version)
        assert release['draft'], 'Published releases are immutable; use a new version'
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        release = request(base + '/releases', json.dumps({'tag_name': 'v' + args.version, 'target_commitish': head, 'name': '모찌 v' + args.version, 'body': args.notes.read_text(), 'draft': True}).encode(), 'POST')
    for file in files:
        digest = 'sha256:' + hashlib.sha256(file.read_bytes()).hexdigest()
        existing = next((a for a in release['assets'] if a['name'] == file.name), None)
        if existing:
            assert existing.get('digest') == digest, 'Draft asset differs: ' + file.name
            continue
        print('Uploading ' + file.name, flush=True)
        request(release['upload_url'].split('{')[0] + '?name=' + file.name, file.read_bytes(), 'POST', 'application/octet-stream')
    result = request(base + '/releases/' + str(release['id']), json.dumps({'draft': False, 'make_latest': 'true'}).encode(), 'PATCH')
    print(result['html_url'], flush=True)

if __name__ == '__main__':
    main()
