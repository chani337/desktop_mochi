# 모션 아트워크

사용자 제공 참조: https://chatgpt.com/s/m_6abbd495d2e08191b4878ad7a055d053

내장 imagegen 도구로 참조의 배경·라벨을 제거하고 투명 PNG 시트로 정리했습니다. 두 앱에서 같은 PNG와 카탈로그를 사용합니다. 원본은 정지 포즈 18종이며 실제 움직임은 앱 렌더러의 호흡·회전·이동 효과입니다. 카탈로그 rect는 이미지의 포즈별 실제 픽셀 영역입니다.

## 생성 프롬프트

Use case: background-extraction. Edit target: the supplied 18-pose hamster sheet. Produce ONE production sprite atlas with TRUE transparent alpha background, exactly 6 columns by 3 rows of equal SQUARE cells, canvas 3072x1536 (2:1). Preserve the SAME original cream fluffy hamster, all 18 original poses and expressions in precisely the SAME row-major order. Remove all Korean labels, label pills, white sticker outlines, background, and ground shadows. Keep small gesture accents/hearts/zzz/music notes near each hamster. Arrange each existing hamster entirely inside its own cell with 10% transparent safety margin, consistent character scale, bottom aligned, no touching adjacent cells. Row1: neutral standing, wink, delighted, picked-up one-paw raised, walking, sitting. Row2: laughing, shy with heart, surprised, crying, angry, curious head tilt. Row3: waving, clapping, jumping, running, asleep lying down with zzz, dancing with music notes. Preserve exact character identity and pose shapes from the reference rather than inventing alternatives. No text anywhere except zzz as pictorial sleep accent. No grid lines, no backdrop, no fake checkerboard. This is a cutout cleanup and equal-grid rearrangement of the reference, not a new character design.
