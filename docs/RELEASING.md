# 릴리스와 자동 업데이트

v2.3.0부터 Mac은 Sparkle, Windows 설치형은 electron-updater로 GitHub Releases를 확인합니다. ZIP/EXE만 올려서는 자동 업데이트가 작동하지 않습니다. 아래 메타데이터까지 함께 게시해야 합니다.

## 최초 설치와 기존 사용자

- Mac: `DesktopCat.app`을 응용 프로그램 폴더에 옮겨 실행합니다. 구버전에서 v2.3.0은 한 번 직접 교체해야 합니다.
- Windows: `Mochi-Setup-버전.exe`를 한 번 설치합니다. 구 ZIP 앱은 종료하고 설치형을 실행합니다. `%APPDATA%\mochi-desktop`을 공유하므로 기존 설정은 유지합니다.
- ZIP 버전은 자동 교체 대상이 아닙니다. 트레이에서 업데이트 확인을 누르면 설치형 전환 안내를 표시합니다.
- Apple 공증과 Windows 배포용 코드 서명은 아직 없습니다. 최초 실행 경고가 남으며, 이 사실을 릴리스 안내에서 숨기지 않습니다.

## 버전 준비

1. `windows/mochi-desktop/package.json`과 lockfile 버전을 동일하게 올립니다.
2. `macos/DesktopCat/Info.plist`의 `CFBundleShortVersionString`을 같은 버전으로, `CFBundleVersion`을 기존보다 큰 정수로 올립니다.
3. README 다운로드 링크와 CHANGELOG를 갱신합니다. 커밋은 `feat: 한글 설명` 형식입니다.
4. 테스트는 별도 설정 저장소를 사용합니다. 실제 사용자 설정에서 테스트하지 않습니다.

## 빌드와 검증

이 저장소의 빌드·서명 도구는 macOS + Xcode Command Line Tools + Node.js 22 이상을 사용합니다. Sparkle는 고정 버전과 SHA-256으로 검증한 뒤 다운로드합니다. 개인 키는 저장소에 포함하지 않습니다.

```sh
scripts/build-release.command

# AppKit 크기·앱 등록·백업 복원 검사
macos/DesktopCat/DesktopCat.app/Contents/MacOS/DesktopCat --size-test
macos/DesktopCat/DesktopCat.app/Contents/MacOS/DesktopCat --registration-test
macos/DesktopCat/DesktopCat.app/Contents/MacOS/DesktopCat --update-test

# Electron UI 및 앱 등록 검사 (macOS에서 공통 UI 실행)
cd windows/mochi-desktop
npm start -- --smoke-test
```

빌드 결과는 `release/v버전/`에 생성됩니다. 이미 같은 버전 디렉터리가 있으면 덮어쓰지 않고 멈춥니다. 결과를 확인한 뒤 필요하면 해당 디렉터리를 별도 보관하고 다시 빌드하세요.

## Sparkle 서명 키

- 공개키는 앱의 `SUPublicEDKey`에 고정되어 있습니다.
- 개인키는 최초 구성한 Mac의 **로그인 키체인**, Sparkle 계정 **`desktop-mochi`**에 보관되어 있습니다.
- 빌드 도구는 이 키로 Mac ZIP과 appcast를 서명합니다. 새 버전도 **같은 키**를 사용해야 합니다.
- 다른 Mac에서 릴리스하려면 키체인의 키를 안전하게 이전해야 합니다. 임의로 새 키를 만들어 공개키를 바꾸면 기존 앱의 업데이트가 끊깁니다.
- 키체인을 초기화하기 전에 안전한 별도 키 백업을 마련하세요. 개인키를 Git, 릴리스 파일, 로그에 넣지 마세요.
- Sparkle 서명은 Apple 공증을 대신하지 않습니다. Developer ID를 갖추면 별도로 공증을 도입할 수 있습니다.

서명 도구의 키체인 접근이 제한된 환경에서는 공식 `generate_keys --account desktop-mochi -x 파일경로`로 본인 키를 안전한 임시 파일에 내보내고 `SPARKLE_ED_KEY_FILE`에 해당 경로를 지정할 수 있습니다. 파일은 저장소 밖에 권한 600으로 보관하고, 배포가 끝나면 삭제하세요. 개인키 내용은 출력하지 않습니다.

## 게시

릴리스 안내문을 파일로 작성하고 먼저 변경 사항을 커밋·푸시합니다. 예시는 2.3.0이며 다음 배포 때는 새 버전을 사용합니다.

```sh
# 업로드 없이 서명·버전·해시 검사
python3 scripts/publish-release.py 2.3.0 --notes docs/releases/2.3.0.md

# 검사를 다시 수행한 후 업로드·공개
python3 scripts/publish-release.py 2.3.0 --notes docs/releases/2.3.0.md --publish
```

인증은 `GH_TOKEN` / `GITHUB_TOKEN` 또는 기존 Git HTTPS 자격 증명을 사용합니다. 토큰을 파일에 하드코딩하지 않습니다. 게시 스크립트는 원격 main과 현재 커밋이 같은지 확인하고, 초안에 아래 6개 파일을 모두 올린 다음 공개합니다. 실패한 초안은 동일 파일로 재실행할 수 있으며, 이미 공개된 릴리스는 수정하지 않습니다.

| 파일 | 용도 |
| --- | --- |
| `DesktopCat.zip` | Mac 앱 |
| `appcast.xml` | 서명된 Mac 업데이트 목록과 ZIP 서명 |
| `Mochi-Setup-버전.exe` | Windows 설치·업데이트 |
| `Mochi-Setup-버전.exe.blockmap` | Windows 차등 다운로드 |
| `latest.yml` | Windows 버전·파일 크기·SHA-512 |
| `Mochi-버전-win-x64.zip` | 수동 실행용 포터블 배포 |

Mac은 `releases/latest/download/appcast.xml`, Windows는 GitHub의 최신 안정 릴리스와 `latest.yml`을 읽습니다. Mac appcast의 다운로드 주소는 특정 버전 태그를 가리킵니다. **서명 이후 appcast를 직접 편집하지 마세요.**

## 검증 한계

자동 검사에는 백업·복원, 업데이트 상태 전이, 설치 전 백업 실패 시 중단, 서명·체크섬 검증이 포함됩니다. macOS에서 Sparkle 로드와 기존 기능을 확인합니다. 실제 새 버전으로 앱을 교체하는 전체 동작과 Windows PC에서의 NSIS 설치·재실행은 별도로 확인해야 합니다. 확인하지 않은 검증을 완료했다고 기록하지 않습니다.

## 참고

- [Sparkle 설치·서명 안내](https://sparkle-project.org/documentation/)
- [Sparkle 업데이트 게시](https://sparkle-project.org/documentation/publishing/)
- [electron-updater 소스와 사용 안내](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater)
