# 모찌 캐릭터 원화

내장 ImageGen 도구로 기본 원화를 새로 생성하고, 그 원화를 바탕으로 잠든 표정을 생성했습니다. 이전 참고 이미지와 민트색 토끼 그림을 입력으로 사용하지 않았습니다. 배경은 알파 투명 PNG입니다.

- `mochi-art.png`: 기본 원화
- `DesktopCat.app/Contents/Resources/mochi.png`: Mac 앱이 사용하는 기본 원화
- `DesktopCat.app/Contents/Resources/mochi-sleep.png`: 수면·눈 깜빡임 표정
- Windows 소스의 `assets/`에도 같은 두 이미지를 포함했습니다.

## 기본 원화 프롬프트

Use case: stylized-concept. Asset type: production transparent desktop pet character PNG. Create one completely original exceptionally adorable cream baby hamster named Mochi, full body front view, tiny round peach ears, ridiculously chubby soft pear-shaped body, short tiny paws close to chest, tiny bean feet, huge soft cheeks with subtle apricot blush, tiny shiny dark chocolate oval eyes set low and wide, tiny expressive w-shaped mouth, a delicate warm caramel patch on top of head like a little parted tuft. Premium hand-painted 2.5D kawaii toy illustration, soft matte plush-like surface but smooth clean broad color shapes, minimal fine fur. Art-directed silhouette, endearing slightly shy personality, polished collectible mascot. NO thick black outline, NO simplistic stacked geometric circles, NO existing franchise character, no accessories, no signs, no lettering. Center single character fills about 88% of square canvas with whole ears and feet visible. Absolutely genuinely TRANSPARENT background with alpha, no white canvas, no checkerboard drawn in, no floor, no cast shadow. Must remain recognizable and cute at 57px height. Warm cream, peach and caramel palette, gentle depth and restrained detail. This is a final in-app sprite, not a concept sheet or mockup.

## 수면 표정 프롬프트

Use case: identity-preserve. Edit target is the attached transparent desktop hamster sprite. Produce its sleeping animation pose. Keep EXACT same original character, proportions, cream/caramel fur, peach blush, centered size and silhouette, paws and feet, transparent alpha background. Change only the two eyes to peacefully closed dark chocolate curved eyelids and slightly relax the mouth. Same front view, no props, no nightcap, no text, no drawn Z, no pillow, no shadow, no extra objects. Preserve transparent background, whole character and margins.
