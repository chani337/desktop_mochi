import AppKit
import QuartzCore

final class PaletteView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        let arc = NSBezierPath()
        arc.appendArc(withCenter: NSPoint(x: 170, y: 24), radius: 118, startAngle: 160, endAngle: 20, clockwise: true)
        arc.lineWidth = 68; arc.lineCapStyle = .round
        NSGraphicsContext.saveGraphicsState()
        let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.18)
        shadow.shadowBlurRadius = 12; shadow.shadowOffset = NSSize(width: 0, height: -4); shadow.set()
        NSColor(calibratedWhite: 1, alpha: 0.97).setStroke(); arc.stroke()
        NSGraphicsContext.restoreGraphicsState()
    }
    override func hitTest(_ point: NSPoint) -> NSView? {
        let result = super.hitTest(point)
        return result === self ? nil : result
    }
}

final class PaletteButton: NSButton {
    var symbol = "link"
    var tint = NSColor.systemBlue
    var hovered = false
    private var tracking: NSTrackingArea?
    override func updateTrackingAreas() {
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
        addTrackingArea(area); tracking = area
        super.updateTrackingAreas()
    }
    override func mouseEntered(with event: NSEvent) { hover(true) }
    override func mouseExited(with event: NSEvent) { hover(false) }
    func hover(_ value: Bool) {
        guard hovered != value else { return }
        hovered = value; needsDisplay = true
        let animation = CASpringAnimation(keyPath: "transform.scale")
        animation.fromValue = layer?.presentation()?.value(forKeyPath: "transform.scale") ?? 1
        animation.toValue = value ? 1.15 : 1.0
        animation.stiffness = 320; animation.damping = 19; animation.duration = 0.35
        layer?.setValue(value ? 1.15 : 1.0, forKeyPath: "transform.scale")
        layer?.add(animation, forKey: "hover")
    }
    override func draw(_ dirtyRect: NSRect) {
        let circle = NSBezierPath(ovalIn: NSRect(x: (bounds.width-36)/2, y: 19, width: 36, height: 36))
        tint.withAlphaComponent(hovered ? 0.23 : 0.10).setFill(); circle.fill()
        let config = NSImage.SymbolConfiguration(pointSize: 20, weight: .medium)
            .applying(NSImage.SymbolConfiguration(paletteColors: [tint]))
        let icon = NSImage(systemSymbolName: symbol, accessibilityDescription: title)?.withSymbolConfiguration(config)
        icon?.draw(in: NSRect(x: (bounds.width-22)/2, y: 26, width: 22, height: 22))
        let style = NSMutableParagraphStyle(); style.alignment = .center; style.lineBreakMode = .byTruncatingTail
        (title as NSString).draw(in: NSRect(x: 0, y: 0, width: bounds.width, height: 17), withAttributes: [.font: NSFont.systemFont(ofSize: 10, weight: .medium), .foregroundColor: NSColor(calibratedWhite: 0.2, alpha: 1), .paragraphStyle: style])
    }
}

struct Shortcut: Codable {
    var title: String
    var url: String
    var symbol: String? = nil
    var color: String? = nil
}

enum PetPose { case normal, sleeping, dragging, landing, waving, focusing }

let shortcutSymbols: [(String, String)] = [("웹", "safari"), ("재생", "play.fill"), ("표", "tablecells"), ("폴더", "folder.fill"), ("별", "star.fill"), ("체크", "checkmark.circle.fill"), ("음악", "music.note")]
let shortcutColors: [(String, String, NSColor)] = [("파랑", "blue", .systemBlue), ("빨강", "red", .systemRed), ("초록", "green", .systemGreen), ("주황", "orange", .systemOrange), ("보라", "purple", .systemPurple), ("분홍", "pink", .systemPink)]

func colorForKey(_ key: String?) -> NSColor {
    shortcutColors.first(where: { $0.1 == key })?.2 ?? .systemBlue
}

final class PetPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

final class CatView: NSView {
    private lazy var artwork: NSImage? = Bundle.main.url(forResource: "mochi", withExtension: "png").flatMap { NSImage(contentsOf: $0) }
    private lazy var sleepingArtwork: NSImage? = Bundle.main.url(forResource: "mochi-sleep", withExtension: "png").flatMap { NSImage(contentsOf: $0) }
    var phase: CGFloat = 0
    var excited = false
    var walking = false
    var pose: PetPose = .normal
    var focusText: String?
    var dropTarget = false
    var onClick: (() -> Void)?
    var onDragStarted: (() -> Void)?
    var onDragEnded: (() -> Void)?
    var onLongPress: (() -> Void)?
    var onGestureMove: ((NSPoint) -> Void)?
    var onGestureEnd: ((NSPoint) -> Void)?
    var onDropURL: ((URL) -> Void)?
    var down: NSPoint = .zero
    var origin: NSPoint = .zero
    var dragged = false
    var paletteGesture = false
    var holdTimer: Timer?
    override var isFlipped: Bool { true }
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        registerForDraggedTypes([.URL, .string])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func mouseDown(with event: NSEvent) {
        down = NSEvent.mouseLocation
        origin = window?.frame.origin ?? .zero
        dragged = false; paletteGesture = false
        holdTimer?.invalidate()
        let timer = Timer(timeInterval: 0.24, repeats: false) { [weak self] _ in
            guard let self, !self.dragged else { return }
            self.paletteGesture = true; self.onLongPress?()
        }
        RunLoop.main.add(timer, forMode: .common); holdTimer = timer
    }
    override func mouseDragged(with event: NSEvent) {
        let now = NSEvent.mouseLocation
        if paletteGesture {
            onGestureMove?(now)
        } else if hypot(now.x-down.x, now.y-down.y) > 5 {
            holdTimer?.invalidate()
            if !dragged { onDragStarted?() }
            dragged = true
            window?.setFrameOrigin(NSPoint(x: origin.x+now.x-down.x, y: origin.y+now.y-down.y))
        }
    }
    override func mouseUp(with event: NSEvent) {
        holdTimer?.invalidate()
        if paletteGesture { onGestureEnd?(NSEvent.mouseLocation) }
        else if dragged { onDragEnded?() }
        else { onClick?() }
    }
    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation { dropTarget = true; needsDisplay = true; return .copy }
    override func draggingExited(_ sender: NSDraggingInfo?) { dropTarget = false; needsDisplay = true }
    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        dropTarget = false; needsDisplay = true
        let pasteboard = sender.draggingPasteboard
        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL], let url = urls.first {
            onDropURL?(url); return true
        }
        if let raw = pasteboard.string(forType: .string), let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)) {
            onDropURL?(url); return true
        }
        return false
    }
    override func resetCursorRects() { addCursorRect(bounds, cursor: .openHand) }
    func path(_ pts: [(CGFloat, CGFloat)], fill: NSColor, stroke: Bool = true) {
        let p = NSBezierPath()
        for (i, pt) in pts.enumerated() {
            if i == 0 { p.move(to: NSPoint(x: pt.0, y: pt.1)) }
            else { p.line(to: NSPoint(x: pt.0, y: pt.1)) }
        }
        p.close(); fill.setFill(); p.fill()
        if stroke { NSColor(calibratedWhite: 0.12, alpha: 1).setStroke(); p.lineWidth = 3.2; p.lineJoinStyle = .round; p.stroke() }
    }
    func oval(_ r: NSRect, _ color: NSColor, stroke: Bool = false) {
        let p = NSBezierPath(ovalIn: r); color.setFill(); p.fill()
        if stroke { NSColor(calibratedWhite: 0.12, alpha: 1).setStroke(); p.lineWidth = 3; p.stroke() }
    }
    override func draw(_ dirtyRect: NSRect) {
        if let artwork {
            drawArtwork(artwork)
            return
        }
        let mint = NSColor(calibratedRed: 0.68, green: 0.88, blue: 0.79, alpha: 1)
        let cream = NSColor(calibratedRed: 1, green: 0.97, blue: 0.85, alpha: 1)
        let pink = NSColor(calibratedRed: 1, green: 0.70, blue: 0.70, alpha: 1)
        let ink = NSColor(calibratedRed: 0.20, green: 0.31, blue: 0.28, alpha: 1)
        let resting = pose == .sleeping || pose == .focusing
        let bounce: CGFloat = pose == .landing ? 4 : (excited || pose == .waving ? sin(phase * 2.5) * 5 : (walking ? sin(phase * 1.8) * 2 : sin(phase * 0.6)))
        oval(NSRect(x: 39, y: 163, width: 90, height: 8), dropTarget ? NSColor.systemBlue.withAlphaComponent(0.35) : NSColor.black.withAlphaComponent(0.12))
        NSGraphicsContext.saveGraphicsState()
        let transform = NSAffineTransform()
        transform.translateX(by: 0, yBy: bounce)
        if pose == .dragging { transform.rotate(byDegrees: sin(phase) * 5) }
        if pose == .landing { transform.translateX(by: 0, yBy: 12); transform.scaleX(by: 1.08, yBy: 0.88) }
        transform.concat()
        // Original mint mochi rabbit: asymmetric soft ears, cream belly, tiny paws.
        let step: CGFloat = walking ? sin(phase * 1.8) * 4 : 0
        func shape(_ rect: NSRect, _ color: NSColor, radius: CGFloat) {
            let p = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
            color.setFill(); p.fill(); ink.setStroke(); p.lineWidth = 3; p.stroke()
        }
        shape(NSRect(x: 48, y: 18, width: 27, height: 66), mint, radius: 16)
        shape(NSRect(x: 94, y: 31, width: 30, height: 56), mint, radius: 18)
        oval(NSRect(x: 57, y: 30, width: 9, height: 33), cream)
        oval(NSRect(x: 104, y: 42, width: 10, height: 25), cream)
        shape(NSRect(x: 48, y: 139+step, width: 32, height: 24), mint, radius: 13)
        shape(NSRect(x: 93, y: 139-step, width: 32, height: 24), mint, radius: 13)
        shape(NSRect(x: 27, y: 56, width: 117, height: 97), mint, radius: 45)
        oval(NSRect(x: 54, y: 112, width: 64, height: 34), cream)
        let pawY: CGFloat = pose == .waving ? 70 + sin(phase * 2) * 9 : (pose == .dragging ? 117 : 107)
        shape(NSRect(x: 19, y: 106, width: 21, height: 29), mint, radius: 13)
        shape(NSRect(x: 132, y: pawY, width: 21, height: 29), mint, radius: 13)
        oval(NSRect(x: 40, y: 94, width: 20, height: 12), pink)
        oval(NSRect(x: 110, y: 94, width: 20, height: 12), pink)
        let blink = Int(phase * 10) % 70 < 3
        for x: CGFloat in [62, 109] {
            if resting || excited || blink {
                let eye = NSBezierPath(); eye.move(to: NSPoint(x: x-3, y: 81)); eye.curve(to: NSPoint(x: x+3, y: 81), controlPoint1: NSPoint(x: x-2, y: 76), controlPoint2: NSPoint(x: x+2, y: 76)); eye.lineWidth = 2.8; ink.setStroke(); eye.stroke()
            } else { oval(NSRect(x: x-2, y: 77, width: 4, height: 8), ink) }
        }
        oval(NSRect(x: 81, y: 91, width: 8, height: 5), ink)
        let mouth = NSBezierPath(); mouth.move(to: NSPoint(x: 77, y: 99))
        mouth.curve(to: NSPoint(x: 85, y: 99), controlPoint1: NSPoint(x: 78, y: 105), controlPoint2: NSPoint(x: 83, y: 105))
        mouth.curve(to: NSPoint(x: 93, y: 99), controlPoint1: NSPoint(x: 87, y: 105), controlPoint2: NSPoint(x: 92, y: 105))
        ink.setStroke(); mouth.lineWidth = 2.5; mouth.lineCapStyle = .round; mouth.stroke()
        if excited {
            ("♥" as NSString).draw(at: NSPoint(x: 139, y: 1), withAttributes: [.font: NSFont.systemFont(ofSize: 24), .foregroundColor: NSColor.systemPink])
        }
        if pose == .sleeping {
            ("Zzz" as NSString).draw(at: NSPoint(x: 112, y: 61), withAttributes: [.font: NSFont.systemFont(ofSize: 16, weight: .bold), .foregroundColor: NSColor.systemBlue])
        } else if pose == .dragging {
            ("!" as NSString).draw(at: NSPoint(x: 139, y: 52), withAttributes: [.font: NSFont.systemFont(ofSize: 25, weight: .heavy), .foregroundColor: NSColor.systemOrange])
        } else if pose == .focusing, let focusText {
            let style = NSMutableParagraphStyle(); style.alignment = .center
            (focusText as NSString).draw(in: NSRect(x: 46, y: 120, width: 78, height: 22), withAttributes: [.font: NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .bold), .foregroundColor: ink, .paragraphStyle: style])
        }
        if dropTarget {
            let style = NSMutableParagraphStyle(); style.alignment = .center
            ("놓기!" as NSString).draw(in: NSRect(x: 45, y: 139, width: 80, height: 22), withAttributes: [.font: NSFont.systemFont(ofSize: 15, weight: .bold), .foregroundColor: NSColor.systemBlue, .paragraphStyle: style])
        }
        NSGraphicsContext.restoreGraphicsState()
    }
    private func drawArtwork(_ image: NSImage) {
        let resting = pose == .sleeping || pose == .focusing
        let blink = Int(phase * 10) % 85 < 3
        let sprite = (resting || blink) ? (sleepingArtwork ?? image) : image
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current?.imageInterpolation = .high
        let t = NSAffineTransform()
        t.translateX(by: 85, yBy: 153)
        if pose == .dragging { t.rotate(byDegrees: sin(phase) * 8) }
        else if pose == .waving { t.rotate(byDegrees: sin(phase * 2) * 7); t.translateX(by: 0, yBy: -6) }
        else if walking { t.rotate(byDegrees: sin(phase * 1.8) * 3); t.translateX(by: 0, yBy: -abs(sin(phase * 1.8)) * 4) }
        if pose == .landing { t.scaleX(by: 1.12, yBy: 0.86) }
        else if resting { t.scaleX(by: 1 + sin(phase * 0.5)*0.01, yBy: 1 + sin(phase * 0.5)*0.015) }
        t.translateX(by: -85, yBy: -153); t.concat()
        sprite.draw(in: NSRect(x: 0, y: 9, width: 170, height: 170), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
        NSGraphicsContext.restoreGraphicsState()
        let text: String = dropTarget ? "놓기!" : pose == .focusing ? (focusText ?? "") : pose == .sleeping ? "Zzz" : (excited || pose == .waving) ? "♥" : ""
        if !text.isEmpty {
            let style = NSMutableParagraphStyle(); style.alignment = .center
            (text as NSString).draw(in: NSRect(x: 10, y: 0, width: 150, height: 25), withAttributes: [.font: NSFont.monospacedDigitSystemFont(ofSize: 19, weight: .semibold), .foregroundColor: text == "♥" ? NSColor.systemPink : NSColor(calibratedRed: 0.54, green: 0.35, blue: 0.21, alpha: 1), .paragraphStyle: style])
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var pet: PetPanel!
    var cat: CatView!
    var menuPanel: NSPanel?
    var settings: NSWindow?
    var status: NSStatusItem!
    var timer: Timer?
    var shortcuts: [Shortcut] = []
    var titleFields: [NSTextField] = []
    var urlFields: [NSTextField] = []
    var iconPopups: [NSPopUpButton] = []
    var colorPopups: [NSPopUpButton] = []
    var errorLabel: NSTextField?
    var paletteButtons: [PaletteButton] = []
    var selectedPaletteButton: PaletteButton?
    var walking = true
    var direction: CGFloat = 1
    var tick = 0
    var pauseUntil = Date()
    var lastInteraction = Date()
    var landingUntil = Date.distantPast
    var wavingUntil = Date.distantPast
    var focusEnd: Date?
    var focusWindow: NSWindow?
    var hourField: NSTextField?
    var minuteField: NSTextField?
    var focusStatus: NSTextField?
    var focusError: NSTextField?
    var focusStartButton: NSButton?
    weak var paletteTimerButton: PaletteButton?
    let key = "DesktopCat.shortcuts.v1"

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMainMenu()
        if let data = UserDefaults.standard.data(forKey: key), let saved = try? JSONDecoder().decode([Shortcut].self, from: data) { shortcuts = Array(saved.prefix(5)) }
        else { shortcuts = [Shortcut(title: "검색", url: "https://www.google.com", symbol: "safari", color: "blue"), Shortcut(title: "YouTube", url: "https://www.youtube.com", symbol: "play.fill", color: "red")] }
        walking = UserDefaults.standard.object(forKey: "walking") as? Bool ?? true
        pet = PetPanel(contentRect: NSRect(x: 200, y: 100, width: 57, height: 60), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        pet.isOpaque = false; pet.backgroundColor = .clear; pet.hasShadow = false
        pet.level = .floating; pet.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]; pet.hidesOnDeactivate = false
        cat = CatView(frame: NSRect(x: 0, y: 0, width: 57, height: 60)); pet.contentView = cat
        cat.bounds = NSRect(x: 0, y: 0, width: 170, height: 180)
        cat.toolTip = "클릭: 바로가기 · 꾹 누르고 쓸기: 바로 실행 · 드래그: 위치 이동"
        cat.onClick = { [weak self] in self?.touch(); self?.toggleMenu() }
        cat.onDragStarted = { [weak self] in
            guard let self else { return }; self.touch(); self.closeMenu(); self.cat.pose = .dragging
        }
        cat.onDragEnded = { [weak self] in
            guard let self else { return }; self.landingUntil = Date().addingTimeInterval(0.45); self.pauseUntil = Date().addingTimeInterval(3)
        }
        cat.onLongPress = { [weak self] in
            guard let self else { return }; self.touch(); if self.menuPanel == nil { self.toggleMenu() }
        }
        cat.onGestureMove = { [weak self] point in self?.updatePaletteSelection(at: point) }
        cat.onGestureEnd = { [weak self] point in self?.finishPaletteSelection(at: point) }
        cat.onDropURL = { [weak self] url in self?.addDroppedShortcut(url) }
        if let screen = NSScreen.main { pet.setFrameOrigin(NSPoint(x: screen.visibleFrame.maxX-240, y: screen.visibleFrame.minY+40)) }
        pet.orderFrontRegardless()
        setupStatus()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0/30.0, repeats: true) { [weak self] _ in self?.animate() }
        if CommandLine.arguments.contains("--snapshot") { snapshot(); NSApp.terminate(nil) }
        if CommandLine.arguments.contains("--settings") { showSettings() }
        if CommandLine.arguments.contains("--timer") { showFocusTimer() }
        if CommandLine.arguments.contains("--palette") { toggleMenu() }
        if CommandLine.arguments.contains("--palette-preview") {
            toggleMenu()
            if let view = menuPanel?.contentView, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
                view.cacheDisplay(in: view.bounds, to: rep)
                if let png = rep.representation(using: .png, properties: [:]) {
                    try? png.write(to: URL(fileURLWithPath: FileManager.default.currentDirectoryPath + "/palette-preview.png"))
                }
            }
            NSApp.terminate(nil)
        }
    }
    func setupMainMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "모찌")
        let timerItem = NSMenuItem(title: "집중 타이머…", action: #selector(showFocusTimer), keyEquivalent: "t")
        timerItem.target = self; appMenu.addItem(timerItem)
        let settingsItem = NSMenuItem(title: "바로가기 설정…", action: #selector(showSettings), keyEquivalent: ",")
        settingsItem.target = self
        appMenu.addItem(settingsItem)
        let quitItem = NSMenuItem(title: "모찌 종료", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        appMenu.addItem(quitItem); appItem.submenu = appMenu; main.addItem(appItem)
        let editItem = NSMenuItem()
        let edit = NSMenu(title: "편집")
        for (title, selector, key) in [
            ("실행 취소", "undo:", "z"),
            ("잘라내기", "cut:", "x"),
            ("복사", "copy:", "c"),
            ("붙여넣기", "paste:", "v"),
            ("전체 선택", "selectAll:", "a")
        ] {
            edit.addItem(NSMenuItem(title: title, action: Selector(selector), keyEquivalent: key))
        }
        editItem.submenu = edit; main.addItem(editItem)
        NSApp.mainMenu = main
    }
    func setupStatus() {
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        status.button?.image = NSImage(systemSymbolName: "timer", accessibilityDescription: "모찌 집중 타이머")
        status.button?.title = " 모찌"
        status.button?.toolTip = "모찌 · 집중 타이머 및 설정"
        let menu = NSMenu()
        for (title, action) in [("모찌 데려오기", #selector(bringBack)), ("바로가기 설정…", #selector(showSettings)), ("집중 타이머 설정…", #selector(showFocusTimer)), ("산책 시작 / 멈춤", #selector(toggleWalking)), ("종료", #selector(quit))] {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: ""); item.target = self; menu.addItem(item)
        }
        status.menu = menu
    }
    func touch() {
        lastInteraction = Date(); cat.pose = .normal; cat.focusText = nil
    }
    func saveShortcuts() {
        if let data = try? JSONEncoder().encode(shortcuts) { UserDefaults.standard.set(data, forKey: key) }
    }
    func inferredSymbol(for url: URL) -> String {
        let raw = url.absoluteString.lowercased()
        if raw.contains("youtube") { return "play.fill" }
        if raw.contains("spreadsheets") { return "tablecells" }
        if url.isFileURL { return "folder.fill" }
        return "safari"
    }
    func addDroppedShortcut(_ url: URL) {
        touch()
        guard shortcuts.count < 5 else {
            showSettings(); errorLabel?.stringValue = "바로가기는 최대 5개예요. 하나를 지운 뒤 다시 놓아 주세요."; errorLabel?.textColor = .systemRed; return
        }
        let rawName = url.isFileURL ? url.deletingPathExtension().lastPathComponent : (url.host?.replacingOccurrences(of: "www.", with: "") ?? "새 링크")
        shortcuts.append(Shortcut(title: String(rawName.prefix(16)), url: url.absoluteString, symbol: inferredSymbol(for: url), color: shortcutColors[shortcuts.count % shortcutColors.count].1))
        saveShortcuts(); wavingUntil = Date().addingTimeInterval(1.6)
    }
    func animate() {
        tick += 1; cat.phase += 0.10
        let now = Date()
        if let end = focusEnd {
            let remaining = max(0, Int(end.timeIntervalSince(now).rounded(.up)))
            if remaining == 0 {
                focusEnd = nil; touch(); wavingUntil = now.addingTimeInterval(4); NSSound(named: "Glass")?.play(); status.button?.title = " 모찌"
                focusStatus?.stringValue = "집중 완료! 잠깐 기지개를 켜요."
                focusStartButton?.title = "시작"; paletteTimerButton?.title = "타이머"; paletteTimerButton?.needsDisplay = true
            } else {
                cat.pose = .focusing; cat.focusText = durationText(remaining)
                status.button?.title = " " + durationText(remaining)
                focusStatus?.stringValue = "남은 시간  " + durationText(remaining)
                let compact = remaining >= 3600 ? String(format: "%d:%02d", remaining/3600, remaining/60%60) : String(format: "%02d:%02d", remaining/60, remaining%60)
                paletteTimerButton?.title = compact; paletteTimerButton?.needsDisplay = true
            }
        } else if now < landingUntil { cat.pose = .landing
        } else if now < wavingUntil { cat.pose = .waving
        } else if now.timeIntervalSince(lastInteraction) > 10 * 60 { cat.pose = .sleeping
        } else if cat.pose != .dragging { cat.pose = .normal; cat.focusText = nil }
        cat.walking = walking && menuPanel == nil && now > pauseUntil && cat.pose == .normal
        if cat.walking {
            let screen = pet.screen ?? NSScreen.main
            if let rect = screen?.visibleFrame {
                var p = pet.frame.origin
                p.x += direction * 0.65
                if p.x < rect.minX || p.x+pet.frame.width > rect.maxX { direction *= -1 }
                p.x = min(max(p.x, rect.minX), rect.maxX-pet.frame.width)
                p.y = min(max(p.y, rect.minY), rect.maxY-pet.frame.height)
                pet.setFrameOrigin(p)
            }
        }
        cat.needsDisplay = true
    }
    func updatePaletteSelection(at screenPoint: NSPoint) {
        guard let panel = menuPanel else { return }
        let local = panel.convertPoint(fromScreen: screenPoint)
        let candidate = paletteButtons.first { $0.frame.insetBy(dx: -9, dy: -9).contains(local) }
        if candidate !== selectedPaletteButton {
            selectedPaletteButton?.hover(false); selectedPaletteButton = candidate; candidate?.hover(true)
        }
    }
    func finishPaletteSelection(at screenPoint: NSPoint) {
        updatePaletteSelection(at: screenPoint)
        if let selectedPaletteButton { selectedPaletteButton.performClick(nil) }
        self.selectedPaletteButton = nil
    }
    func closeMenu() {
        guard let panel = menuPanel else { return }
        menuPanel = nil; cat.excited = false; paletteButtons = []; selectedPaletteButton = nil
        let shrink = CABasicAnimation(keyPath: "transform.scale")
        shrink.fromValue = 1; shrink.toValue = 0.15; shrink.duration = 0.18
        shrink.timingFunction = CAMediaTimingFunction(name: .easeIn)
        shrink.fillMode = .forwards; shrink.isRemovedOnCompletion = false
        panel.contentView?.layer?.add(shrink, forKey: "close")
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.18; panel.animator().alphaValue = 0
        }, completionHandler: { panel.orderOut(nil) })
    }
    func toggleMenu() {
        if menuPanel != nil { closeMenu(); return }
        cat.excited = true
        let width: CGFloat = 340, height: CGFloat = 210
        guard let rect = (pet.screen ?? NSScreen.main)?.visibleFrame else { return }
        let x = min(max(pet.frame.midX-width/2, rect.minX+8), rect.maxX-width-8)
        let y = min(max(pet.frame.maxY-18, rect.minY+8), rect.maxY-height-8)
        let panel = NSPanel(contentRect: NSRect(x: x, y: y, width: width, height: height), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating; panel.isOpaque = false; panel.backgroundColor = .clear
        panel.hasShadow = false; panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let bg = PaletteView(frame: NSRect(x: 0, y: 0, width: width, height: height))
        bg.wantsLayer = true; bg.layer?.masksToBounds = false
        panel.contentView = bg
        bg.layer?.anchorPoint = CGPoint(x: 0.5, y: 0)
        bg.layer?.position = CGPoint(x: width/2, y: 0)
        func button(_ title: String, symbol: String, tint: NSColor, frame: NSRect, action: Selector, tag: Int = -1) -> PaletteButton {
            let b = PaletteButton(frame: frame)
            b.title = title; b.symbol = symbol; b.tint = tint; b.target = self; b.action = action; b.tag = tag
            b.isBordered = false; b.wantsLayer = true; b.layer?.masksToBounds = false
            b.setAccessibilityLabel(title)
            bg.addSubview(b)
            return b
        }
        paletteButtons = []
        for (index, item) in shortcuts.enumerated() {
            let angle: CGFloat = shortcuts.count == 1 ? .pi/2 : .pi * (160 - CGFloat(index)*140/CGFloat(shortcuts.count-1))/180
            let fallback = URL(string: item.url).map(inferredSymbol) ?? "safari"
            let tint = colorForKey(item.color ?? shortcutColors[index % shortcutColors.count].1)
            let b = button(item.title, symbol: item.symbol ?? fallback, tint: tint, frame: NSRect(x: 170+cos(angle)*118-29, y: 24+sin(angle)*118-28, width: 58, height: 58), action: #selector(openShortcut(_:)), tag: index)
            b.toolTip = item.title + " · " + item.url
            paletteButtons.append(b)
            let pop = CASpringAnimation(keyPath: "transform.scale")
            pop.fromValue = 0.01; pop.toValue = 1; pop.stiffness = 250; pop.damping = 14
            pop.duration = 0.55; pop.beginTime = CACurrentMediaTime()+0.045*Double(index)+0.05
            pop.fillMode = .backwards
            b.layer?.add(pop, forKey: "pop")
        }
        if shortcuts.isEmpty {
            let add = button("링크 추가", symbol: "plus", tint: .systemBlue, frame: NSRect(x: 141, y: 114, width: 58, height: 58), action: #selector(showSettings))
            add.toolTip = "나만의 바로가기 추가"
        }
        _ = button("설정", symbol: "slider.horizontal.3", tint: .darkGray, frame: NSRect(x: 99, y: 12, width: 44, height: 58), action: #selector(showSettings))
        paletteTimerButton = button("타이머", symbol: "timer", tint: .darkGray, frame: NSRect(x: 148, y: 12, width: 44, height: 58), action: #selector(showFocusTimer))
        _ = button("닫기", symbol: "xmark", tint: .darkGray, frame: NSRect(x: 197, y: 12, width: 44, height: 58), action: #selector(dismiss))
        menuPanel = panel; panel.alphaValue = 0; panel.orderFrontRegardless()
        let spring = CASpringAnimation(keyPath: "transform.scale")
        spring.fromValue = 0.12; spring.toValue = 1; spring.stiffness = 230; spring.damping = 18; spring.duration = 0.55
        bg.layer?.add(spring, forKey: "unfold")
        NSAnimationContext.runAnimationGroup { context in context.duration = 0.16; panel.animator().alphaValue = 1 }
    }
    @objc func dismiss() { closeMenu() }
    @objc func openShortcut(_ sender: NSButton) {
        guard shortcuts.indices.contains(sender.tag), let url = URL(string: shortcuts[sender.tag].url) else { return }
        if !NSWorkspace.shared.open(url) {
            let alert = NSAlert(); alert.messageText = "바로가기를 열 수 없어요"; alert.informativeText = "주소와 연결된 앱을 확인해 주세요.\n\(url.absoluteString)"; NSApp.activate(ignoringOtherApps: true); alert.runModal()
        }
        closeMenu(); touch(); wavingUntil = Date().addingTimeInterval(1.6); pauseUntil = Date().addingTimeInterval(2)
    }
    func durationText(_ seconds: Int) -> String {
        if seconds >= 3600 { return String(format: "%d:%02d:%02d", seconds/3600, seconds/60%60, seconds%60) }
        return String(format: "%02d:%02d", seconds/60, seconds%60)
    }
    @objc func showFocusTimer() {
        closeMenu(); touch()
        if let focusWindow { focusWindow.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 420, height: 310), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        w.title = "모찌 · 집중 타이머"; w.isReleasedWhenClosed = false; w.center()
        let v = w.contentView!
        func label(_ text: String, _ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ size: CGFloat = 14) -> NSTextField {
            let l = NSTextField(labelWithString: text); l.font = .systemFont(ofSize: size, weight: .medium)
            l.frame = NSRect(x: x, y: y, width: width, height: 28); v.addSubview(l); return l
        }
        _ = label("모찌와 함께 집중하기", 24, 256, 370, 23)
        focusStatus = label("얼마나 집중할까요?", 24, 215, 370, 17)
        let h = NSTextField(frame: NSRect(x: 24, y: 151, width: 100, height: 40))
        let m = NSTextField(frame: NSRect(x: 205, y: 151, width: 100, height: 40))
        h.font = .monospacedDigitSystemFont(ofSize: 26, weight: .medium); m.font = h.font
        h.alignment = .center; m.alignment = .center
        let stored = UserDefaults.standard.integer(forKey: "focusDurationMinutes")
        let minutes = stored > 0 && stored < 1440 ? stored : 25
        h.stringValue = String(minutes/60); m.stringValue = String(minutes%60)
        h.setAccessibilityLabel("시간"); m.setAccessibilityLabel("분")
        v.addSubview(h); v.addSubview(m); hourField = h; minuteField = m
        _ = label("시간", 133, 155, 55, 18); _ = label("분", 316, 155, 55, 18)
        _ = label("1분부터 23시간 59분까지 설정할 수 있어요.", 24, 111, 380, 12)
        focusError = label("", 24, 76, 380, 12); focusError?.textColor = .systemRed
        let stop = NSButton(title: "타이머 종료", target: self, action: #selector(stopFocus)); stop.bezelStyle = .rounded
        stop.frame = NSRect(x: 24, y: 24, width: 130, height: 34); v.addSubview(stop)
        let start = NSButton(title: focusEnd == nil ? "시작" : "새 시간으로 시작", target: self, action: #selector(startFocus)); start.bezelStyle = .rounded; start.keyEquivalent = "\r"
        start.frame = NSRect(x: 228, y: 24, width: 168, height: 34); v.addSubview(start); focusStartButton = start
        focusWindow = w; w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    @objc func startFocus() {
        guard let h = Int(hourField?.stringValue.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""),
              let m = Int(minuteField?.stringValue.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""),
              (0...23).contains(h), (0...59).contains(m), h*60+m > 0 else {
            focusError?.stringValue = "시간은 0–23, 분은 0–59로 입력해 주세요. 최소 1분이에요."; return
        }
        focusError?.stringValue = ""; touch()
        focusEnd = Date().addingTimeInterval(TimeInterval((h*60+m)*60))
        UserDefaults.standard.set(h*60+m, forKey: "focusDurationMinutes")
        focusStartButton?.title = "새 시간으로 시작"
    }
    @objc func stopFocus() {
        focusEnd = nil; touch(); status.button?.title = " 모찌"
        focusStatus?.stringValue = "타이머를 종료했어요."; focusError?.stringValue = ""; focusStartButton?.title = "시작"
        paletteTimerButton?.title = "타이머"; paletteTimerButton?.needsDisplay = true
    }
    @objc func toggleWalking() { walking.toggle(); UserDefaults.standard.set(walking, forKey: "walking"); if menuPanel != nil { closeMenu(); toggleMenu() } }
    @objc func bringBack() { closeMenu(); if let r = NSScreen.main?.visibleFrame { pet.setFrameOrigin(NSPoint(x: r.midX-pet.frame.width/2, y: r.minY+40)) }; pet.orderFrontRegardless() }
    @objc func quit() { NSApp.terminate(nil) }
    @objc func showSettings() {
        closeMenu()
        if let settings { settings.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 820, height: 460), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        w.title = "모찌 · 바로가기 설정"; w.isReleasedWhenClosed = false; w.center()
        let view = w.contentView!
        func label(_ text: String, _ frame: NSRect, _ size: CGFloat = 13) {
            let l = NSTextField(wrappingLabelWithString: text); l.font = .systemFont(ofSize: size); l.frame = frame; view.addSubview(l)
        }
        label("모찌의 바로가기", NSRect(x: 25, y: 402, width: 720, height: 30), 23)
        label("링크를 모찌 위에 놓아도 추가돼요. 여기서는 아이콘과 색을 바꾸고 화살표로 순서를 정할 수 있어요.", NSRect(x: 25, y: 362, width: 770, height: 35))
        label("이름", NSRect(x: 25, y: 335, width: 105, height: 20))
        label("주소", NSRect(x: 138, y: 335, width: 350, height: 20))
        label("아이콘", NSRect(x: 500, y: 335, width: 100, height: 20))
        label("색", NSRect(x: 610, y: 335, width: 90, height: 20))
        label("순서", NSRect(x: 716, y: 335, width: 80, height: 20))
        titleFields = []; urlFields = []; iconPopups = []; colorPopups = []
        for i in 0..<5 {
            let y = CGFloat(298-i*43)
            let t = NSTextField(frame: NSRect(x: 25, y: y, width: 105, height: 27)); t.placeholderString = "바로가기 \(i+1)"
            let u = NSTextField(frame: NSRect(x: 138, y: y, width: 350, height: 27)); u.placeholderString = "https://example.com"
            if i < shortcuts.count { t.stringValue = shortcuts[i].title; u.stringValue = shortcuts[i].url }
            let icons = NSPopUpButton(frame: NSRect(x: 500, y: y, width: 102, height: 27)); icons.addItems(withTitles: shortcutSymbols.map(\.0))
            let colors = NSPopUpButton(frame: NSRect(x: 610, y: y, width: 96, height: 27)); colors.addItems(withTitles: shortcutColors.map(\.0))
            if i < shortcuts.count {
                let inferred = URL(string: shortcuts[i].url).map(inferredSymbol) ?? "safari"
                icons.selectItem(at: shortcutSymbols.firstIndex(where: { $0.1 == (shortcuts[i].symbol ?? inferred) }) ?? 0)
                colors.selectItem(at: shortcutColors.firstIndex(where: { $0.1 == shortcuts[i].color }) ?? (i % shortcutColors.count))
            } else { colors.selectItem(at: i % shortcutColors.count) }
            let up = NSButton(title: "↑", target: self, action: #selector(moveShortcutRow(_:))); up.tag = i; up.bezelStyle = .rounded; up.frame = NSRect(x: 716, y: y, width: 35, height: 27); up.isEnabled = i > 0
            let down = NSButton(title: "↓", target: self, action: #selector(moveShortcutRow(_:))); down.tag = 10+i; down.bezelStyle = .rounded; down.frame = NSRect(x: 756, y: y, width: 35, height: 27); down.isEnabled = i < 4
            titleFields.append(t); urlFields.append(u); iconPopups.append(icons); colorPopups.append(colors)
            [t, u, icons, colors, up, down].forEach(view.addSubview)
        }
        let error = NSTextField(wrappingLabelWithString: "앱 실행 예: shortcuts:// · 파일 열기 예: file:///Users/…"); error.frame = NSRect(x: 25, y: 55, width: 680, height: 42); error.textColor = .secondaryLabelColor; view.addSubview(error); errorLabel = error
        let save = NSButton(title: "저장", target: self, action: #selector(saveSettings)); save.bezelStyle = .rounded; save.keyEquivalent = "\r"; save.frame = NSRect(x: 700, y: 20, width: 95, height: 32); view.addSubview(save)
        settings = w; w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    @objc func moveShortcutRow(_ sender: NSButton) {
        let from = sender.tag >= 10 ? sender.tag-10 : sender.tag
        let to = sender.tag >= 10 ? from+1 : from-1
        guard titleFields.indices.contains(from), titleFields.indices.contains(to) else { return }
        let oldTitle = titleFields[from].stringValue; titleFields[from].stringValue = titleFields[to].stringValue; titleFields[to].stringValue = oldTitle
        let oldURL = urlFields[from].stringValue; urlFields[from].stringValue = urlFields[to].stringValue; urlFields[to].stringValue = oldURL
        let icon = iconPopups[from].indexOfSelectedItem; iconPopups[from].selectItem(at: iconPopups[to].indexOfSelectedItem); iconPopups[to].selectItem(at: icon)
        let color = colorPopups[from].indexOfSelectedItem; colorPopups[from].selectItem(at: colorPopups[to].indexOfSelectedItem); colorPopups[to].selectItem(at: color)
    }
    @objc func saveSettings() {
        var new: [Shortcut] = []
        for i in 0..<5 {
            let title = titleFields[i].stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            var raw = urlFields[i].stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if title.isEmpty && raw.isEmpty { continue }
            if !raw.contains(":") && !raw.isEmpty { raw = "https://" + raw }
            guard !title.isEmpty, let url = URL(string: raw), let scheme = url.scheme, !scheme.isEmpty,
                  !["javascript", "data"].contains(scheme.lowercased()),
                  !(scheme == "https" || scheme == "http") || !(url.host ?? "").isEmpty else {
                errorLabel?.stringValue = "\(i+1)번째 줄의 이름과 주소를 확인해 주세요."; errorLabel?.textColor = .systemRed; return
            }
            let symbol = shortcutSymbols[max(0, iconPopups[i].indexOfSelectedItem)].1
            let color = shortcutColors[max(0, colorPopups[i].indexOfSelectedItem)].1
            new.append(Shortcut(title: String(title.prefix(16)), url: url.absoluteString, symbol: symbol, color: color))
        }
        shortcuts = new
        saveShortcuts()
        settings?.orderOut(nil)
    }
    func snapshot() {
        cat.excited = true
        cat.phase = 1
        guard let rep = cat.bitmapImageRepForCachingDisplay(in: cat.bounds) else { return }
        cat.cacheDisplay(in: cat.bounds, to: rep)
        if let data = rep.representation(using: .png, properties: [:]) {
            try? data.write(to: URL(fileURLWithPath: FileManager.default.currentDirectoryPath + "/character-preview.png"))
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
