import Foundation

enum SettingsBackup {
    static func save(_ settings: [String: Any], directory: URL) throws -> URL? {
        guard !settings.isEmpty else { return nil }
        let fm = FileManager.default
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try PropertyListSerialization.data(fromPropertyList: settings, format: .binary, options: 0)
        let files = try fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).filter { $0.pathExtension == "plist" && $0.lastPathComponent.hasPrefix("settings-") }.sorted { $0.lastPathComponent < $1.lastPathComponent }
        if let last = files.last, let oldData = try? Data(contentsOf: last),
           let old = try? PropertyListSerialization.propertyList(from: oldData, format: nil) as? [String: Any], NSDictionary(dictionary: old).isEqual(to: settings) { return last }
        let previous = files.last.flatMap { Int($0.lastPathComponent.split(separator: "-")[1]) } ?? 0
        let stamp = max(Int(Date().timeIntervalSince1970 * 1000), previous + 1)
        let name = "settings-\(stamp)-\(UUID().uuidString).plist"
        let target = directory.appendingPathComponent(name)
        try data.write(to: target, options: .atomic)
        for old in files.prefix(max(0, files.count - 19)) { try fm.removeItem(at: old) }
        return target
    }
}
