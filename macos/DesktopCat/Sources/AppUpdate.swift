import AppKit
import Sparkle

func updateNeedsRelocation(_ url: URL, downloads: URL) -> Bool {
    let path = url.standardizedFileURL.path
    let root = downloads.standardizedFileURL.path
    return path.hasPrefix(root + "/") || url.pathComponents.contains("AppTranslocation")
}

extension AppDelegate: SPUUpdaterDelegate {
    func testUpdateFeed() {
        precondition(Bundle.main.bundleIdentifier == "local.desktopcat.feed-tests", "Feed test requires isolated app bundle")
        updaterController = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
        do { try updaterController!.updater.start() } catch { print("FEED FAIL: \(error)"); exit(1) }
        updaterController!.updater.checkForUpdateInformation()
        DispatchQueue.main.asyncAfter(deadline: .now()+30) { print("FEED FAIL: timeout"); exit(1) }
    }
    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        if CommandLine.arguments.contains("--update-feed-test") { print("FEED PASS: Sparkle validated signed feed; found version \(item.displayVersionString)"); NSApp.terminate(nil) }
    }
    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        if CommandLine.arguments.contains("--update-feed-test") { print("FEED FAIL: \(error)"); exit(1) }
    }
    var backupDirectory: URL {
        let root = isTestRun ? FileManager.default.temporaryDirectory.appendingPathComponent("mochi-backup-tests") : FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Mochi")
        return root.appendingPathComponent("Backups")
    }
    var preferencesDomain: String { isTestRun ? "local.desktopcat.registration-tests" : (Bundle.main.bundleIdentifier ?? "local.desktopcat.babonyang") }

    @discardableResult func backupCurrentSettings() throws -> URL? {
        try SettingsBackup.save(appPreferences.persistentDomain(forName: preferencesDomain) ?? [:], directory: backupDirectory)
    }
    func updater(_ updater: SPUUpdater, shouldProceedWithUpdate updateItem: SUAppcastItem, updateCheck: SPUUpdateCheck) throws {
        try backupCurrentSettings()
    }
    func updater(_ updater: SPUUpdater, willInstallUpdate item: SUAppcastItem) {
        do { try backupCurrentSettings() } catch { NSLog("Pre-install settings backup failed: %@", error.localizedDescription) }
    }
    @objc func checkForUpdates() {
        closeMenu()
        NSApp.activate(ignoringOtherApps: true)
        let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        if updateNeedsRelocation(Bundle.main.bundleURL, downloads: downloads) {
            let alert = NSAlert(); alert.messageText = "응용 프로그램 폴더로 옮겨 주세요"
            alert.informativeText = "다운로드 폴더나 macOS 임시 실행 위치에서는 자동 업데이트가 차단돼요. 모찌를 종료한 뒤 Finder에서 DesktopCat.app을 응용 프로그램 폴더로 옮기고, 그곳의 앱을 다시 실행해 주세요. 기존 링크와 설정은 유지돼요."
            alert.addButton(withTitle: "폴더 열기"); alert.addButton(withTitle: "나중에")
            if alert.runModal() == .alertFirstButtonReturn {
                NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications"))
                NSWorkspace.shared.activateFileViewerSelecting([Bundle.main.bundleURL.pathComponents.contains("AppTranslocation") ? downloads : Bundle.main.bundleURL])
            }
            return
        }
        guard let updaterController else {
            let alert = NSAlert(); alert.messageText = "업데이트 확인을 시작하지 못했어요"
            alert.informativeText = "모찌를 종료하고 응용 프로그램 폴더에서 다시 실행해 주세요."
            alert.runModal(); return
        }
        updaterController.checkForUpdates(nil)
    }
    @objc func openBackups() {
        do {
            try FileManager.default.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
            NSWorkspace.shared.open(backupDirectory)
        } catch { NSApp.presentError(error) }
    }
    func restoreSettingsData(_ data: Data) throws {
        guard let settings = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
              let rawLinks = settings[key] as? Data else { throw CocoaError(.fileReadCorruptFile) }
        let links = try JSONDecoder().decode([Shortcut].self, from: rawLinks)
        guard links.count <= maxShortcuts, links.allSatisfy({ shortcutURL($0.url) != nil }) else { throw CocoaError(.fileReadCorruptFile) }
        try backupCurrentSettings()
        for name in [key, "walking", "petScalePercent", "focusDurationMinutes", motionSettingsKey] {
            if let value = settings[name] { appPreferences.set(value, forKey: name) }
        }
        shortcuts = links; walking = appPreferences.bool(forKey: "walking")
        applyPetScale(savedPetScale())
        settingsWindowAfterRestore()
    }
    private func settingsWindowAfterRestore() {
        closeMenu(); settings?.orderOut(nil); settings = nil; motionWindow?.close(); motionWindow = nil
    }
    @objc func restoreBackup() {
        let picker = NSOpenPanel(); picker.title = "모찌 설정 백업 선택"; picker.directoryURL = backupDirectory
        picker.canChooseDirectories = false; picker.allowsMultipleSelection = false
        NSApp.activate(ignoringOtherApps: true)
        guard picker.runModal() == .OK, let url = picker.url else { return }
        let confirm = NSAlert(); confirm.messageText = "이 백업으로 설정을 복원할까요?"
        confirm.informativeText = "현재 설정은 먼저 백업합니다."; confirm.addButton(withTitle: "취소"); confirm.addButton(withTitle: "복원")
        guard confirm.runModal() == .alertSecondButtonReturn else { return }
        do { try restoreSettingsData(Data(contentsOf: url)); showSettings() } catch { NSApp.presentError(error) }
    }
    func testUpdateBackups() {
        defer { appPreferences.removePersistentDomain(forName: preferencesDomain); try? FileManager.default.removeItem(at: backupDirectory.deletingLastPathComponent()) }
        let downloads = URL(fileURLWithPath: "/Users/test/Downloads")
        precondition(updateNeedsRelocation(downloads.appendingPathComponent("DesktopCat.app"), downloads: downloads))
        precondition(updateNeedsRelocation(URL(fileURLWithPath: "/private/var/folders/test/AppTranslocation/id/d/DesktopCat.app"), downloads: downloads))
        precondition(!updateNeedsRelocation(URL(fileURLWithPath: "/Applications/DesktopCat.app"), downloads: downloads))
        precondition(!updateNeedsRelocation(URL(fileURLWithPath: "/Users/test/Downloads-old/DesktopCat.app"), downloads: downloads))
        let original = [Shortcut(title: "보존 테스트", url: "https://example.com")]
        appPreferences.set(try! JSONEncoder().encode(original), forKey: key)
        appPreferences.set(175, forKey: "petScalePercent")
        let backup = try! backupCurrentSettings()!
        precondition(try! backupCurrentSettings()?.resolvingSymlinksInPath().path == backup.resolvingSymlinksInPath().path)
        appPreferences.set(try! JSONEncoder().encode([Shortcut]()), forKey: key)
        try! restoreSettingsData(Data(contentsOf: backup))
        precondition(shortcuts.count == 1 && petScale == 175)
        let before = appPreferences.data(forKey: key)
        do { try restoreSettingsData(Data("bad".utf8)); fatalError("Invalid backup accepted") } catch {}
        precondition(appPreferences.data(forKey: key) == before)
        let controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
        precondition(controller.updater.feedURL?.scheme == "https")
        precondition(Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String != nil)
        print("UPDATE TEST PASS: backup, deduplication, restore, corrupt rejection, Sparkle initialization")
    }
}
