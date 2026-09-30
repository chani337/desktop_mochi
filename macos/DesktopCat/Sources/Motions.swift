import AppKit

struct Motion: Decodable { let id: String; let name: String; let index: Int; let rect: [Double] }
struct MotionContext: Decodable { let id: String; let name: String; let defaultMotion: String }
struct MotionCatalog: Decodable { let motions: [Motion]; let contexts: [MotionContext] }
let motionSettingsKey = "DesktopCat.motions.v1"
let motionCatalog: MotionCatalog = {
    let url = Bundle.main.url(forResource: "motions", withExtension: "json")!
    return try! JSONDecoder().decode(MotionCatalog.self, from: Data(contentsOf: url))
}()
func validatedMotions(_ value: [String: String]) -> [String: String] {
    Dictionary(uniqueKeysWithValues: motionCatalog.contexts.map { context in
        (context.id, motionCatalog.motions.contains(where: { $0.id == value[context.id] }) ? value[context.id]! : context.defaultMotion)
    })
}
func selectedMotion(_ context: String) -> Motion {
    let mappings = validatedMotions(appPreferences.dictionary(forKey: motionSettingsKey) as? [String: String] ?? [:])
    return motionCatalog.motions.first { $0.id == mappings[context] } ?? motionCatalog.motions[0]
}
let motionSprites: [NSImage] = {
    guard let url = Bundle.main.url(forResource: "mochi-motions", withExtension: "png"),
          let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return [] }
    return motionCatalog.motions.compactMap { motion in
        let cell = CGRect(x: motion.rect[0], y: motion.rect[1], width: motion.rect[2], height: motion.rect[3])
        guard let crop = cg.cropping(to: cell) else { return nil }
        return NSImage(cgImage: crop, size: NSSize(width: 170, height: 170))
    }
}()
func drawMotion(_ motion: Motion, in rect: NSRect, phase: CGFloat, facing: CGFloat = 1) {
    guard motionSprites.indices.contains(motion.index) else { return }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current?.imageInterpolation = .high
    let t = NSAffineTransform(); t.translateX(by: rect.midX, yBy: rect.minY + rect.height * 0.85)
    t.scaleX(by: facing < 0 ? -1 : 1, yBy: 1)
    switch motion.id {
    case "walk", "run": t.rotate(byDegrees: sin(phase*1.8)*4); t.translateX(by: 0, yBy: -abs(sin(phase*1.8))*rect.height*0.025)
    case "wave", "dance": t.rotate(byDegrees: sin(phase*1.5)*6)
    case "held", "curious": t.rotate(byDegrees: sin(phase)*5)
    case "jump": t.translateX(by: 0, yBy: -abs(sin(phase))*rect.height*0.07)
    case "clap", "happy", "laugh": t.translateX(by: 0, yBy: -abs(sin(phase*1.5))*rect.height*0.03); t.scaleX(by: 1+sin(phase*1.5)*0.02, yBy: 1)
    default: t.scaleX(by: 1+sin(phase*0.5)*0.01, yBy: 1+sin(phase*0.5)*0.015)
    }
    t.translateX(by: -rect.midX, yBy: -(rect.minY+rect.height*0.85)); t.concat()
    let crop = motion.rect; let scale = min(rect.width / crop[2], rect.height / crop[3])
    let target = NSRect(x: rect.midX-crop[2]*scale/2, y: rect.midY-crop[3]*scale/2, width: crop[2]*scale, height: crop[3]*scale)
    motionSprites[motion.index].draw(in: target, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    NSGraphicsContext.restoreGraphicsState()
}
final class MotionPreview: NSView {
    var context = "idle"
    override var isFlipped: Bool { true }
    override func draw(_ dirtyRect: NSRect) { drawMotion(selectedMotion(context), in: bounds.insetBy(dx: 3, dy: 3), phase: CGFloat(Date.timeIntervalSinceReferenceDate * 3)) }
}
extension AppDelegate {
    @objc func showMotions() {
        closeMenu()
        if let motionWindow { motionWindow.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 590, height: 670), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        w.title = "모찌 · 상황별 모션"; w.isReleasedWhenClosed = false; w.center()
        let view = w.contentView!
        let title = NSTextField(labelWithString: "모찌의 오늘은 어떤 모습?"); title.font = .systemFont(ofSize: 22, weight: .semibold); title.frame = NSRect(x: 24, y: 620, width: 540, height: 30); view.addSubview(title)
        let hint = NSTextField(labelWithString: "18가지 모습 · 선택하면 즉시 적용하고 자동 저장해요."); hint.frame = NSRect(x: 24, y: 594, width: 540, height: 22); hint.textColor = .secondaryLabelColor; view.addSubview(hint)
        for (index, context) in motionCatalog.contexts.enumerated() {
            let y = 524 - CGFloat(index)*64
            let preview = MotionPreview(frame: NSRect(x: 24, y: y, width: 62, height: 62)); preview.context = context.id; view.addSubview(preview)
            let label = NSTextField(labelWithString: context.name); label.frame = NSRect(x: 106, y: y+20, width: 220, height: 24); view.addSubview(label)
            let select = NSPopUpButton(frame: NSRect(x: 335, y: y+18, width: 225, height: 28)); select.tag = index
            select.addItems(withTitles: motionCatalog.motions.map(\.name)); select.selectItem(at: selectedMotion(context.id).index); select.target = self; select.action = #selector(changeMotion(_:)); view.addSubview(select)
        }
        let reset = NSButton(title: "기본 모션으로 되돌리기", target: self, action: #selector(resetMotions)); reset.bezelStyle = .rounded; reset.frame = NSRect(x: 330, y: 24, width: 230, height: 32); view.addSubview(reset)
        motionWindow = w; w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    @objc func changeMotion(_ sender: NSPopUpButton) {
        guard motionCatalog.contexts.indices.contains(sender.tag), motionCatalog.motions.indices.contains(sender.indexOfSelectedItem) else { return }
        var mapping = validatedMotions(appPreferences.dictionary(forKey: motionSettingsKey) as? [String: String] ?? [:])
        mapping[motionCatalog.contexts[sender.tag].id] = motionCatalog.motions[sender.indexOfSelectedItem].id
        appPreferences.set(mapping, forKey: motionSettingsKey)
    }
    @objc func resetMotions() {
        appPreferences.set(validatedMotions([:]), forKey: motionSettingsKey)
        for case let select as NSPopUpButton in motionWindow?.contentView?.subviews ?? [] { select.selectItem(at: selectedMotion(motionCatalog.contexts[select.tag].id).index) }
    }
    func testMotions() {
        assert(motionSprites.count == 18)
        walking = true; pauseUntil = .distantPast; direction = 1; cat.pose = .normal
        if let area = pet.screen?.visibleFrame {
            pet.setFrameOrigin(NSPoint(x: area.maxX-pet.frame.width, y: area.minY+30)); animate(); assert(cat.facing == -1)
            direction = -1; pet.setFrameOrigin(NSPoint(x: area.minX, y: area.minY+30)); animate(); assert(cat.facing == 1)
        }
        walking = false
        assert(selectedMotion("sleeping").id == "sleep")
        appPreferences.set(["idle": "dance", "sleeping": "bad"], forKey: motionSettingsKey)
        assert(selectedMotion("idle").id == "dance" && selectedMotion("sleeping").id == "sleep")
        showMotions(); assert(motionWindow!.contentView!.subviews.compactMap { $0 as? NSPopUpButton }.count == 8)
        resetMotions(); assert(selectedMotion("idle").id == "idle")
        let content = motionWindow!.contentView!
        if let bitmap = content.bitmapImageRepForCachingDisplay(in: content.bounds) {
            content.cacheDisplay(in: content.bounds, to: bitmap)
            try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "/tmp/mochi-native-motions.png"))
        }
        print("PASS: 18 sprites, 8 contexts, mapping validation and reset")
    }
}
