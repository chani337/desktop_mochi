# 프로젝트 작업 규칙

- 커밋 메시지는 `feat: 한글 설명`, `fix(macos): 한글 설명` 같은 Conventional Commits 형식을 사용한다.
- 사용자 설정 식별자와 저장 위치를 유지한다. 테스트에는 반드시 별도 저장소를 사용한다.
- 업데이트 파일은 `scripts/build-release.command`로 생성하고 `scripts/publish-release.py`로 검증·게시한다.
- Mac과 Windows 버전, README, CHANGELOG를 함께 갱신한다. Mac `CFBundleVersion`은 이전 배포보다 증가시킨다.
- 릴리스에는 Mac ZIP과 서명된 `appcast.xml`, Windows 설치 EXE·blockmap·`latest.yml`·ZIP을 모두 포함한다. 파일 업로드를 마친 다음 초안 릴리스를 공개한다.
- Sparkle 키는 로그인 키체인 `desktop-mochi` 계정에 보관한다. 개인키를 저장소나 릴리스에 넣지 않으며 공개키를 임의 교체하지 않는다.
- 실제 Windows 설치·재실행을 테스트하지 않았다면 검증 한계를 명시한다.
