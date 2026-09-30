!ifndef MOCHI_RECOVERY_UPGRADE
!define MOCHI_RECOVERY_UPGRADE

# Never execute an older uninstaller: it can contain the broken process check.
# The regular installApplicationFiles step replaces binaries, app.asar and the
# uninstaller, then registryAddInstallInfo updates the existing app registration.
# No recursive directory deletion: INSTDIR can be a user-selected shared folder.
# Retire the now-unreferenced upstream function without making warnings fatal.
!pragma warning disable 6010
!macroundef uninstallOldVersion
!macro uninstallOldVersion ROOT_KEY
  Push $R1
  ReadRegStr $R1 ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R1 != ""
    GetFullPathName $R1 "$R1"
    GetFullPathName $R0 "$INSTDIR"
    ${If} $R1 != $R0
      MessageBox MB_OK|MB_ICONEXCLAMATION "모찌 복구 업데이트는 기존 설치 위치를 사용해야 합니다.$\r$\n기존 위치: $R1$\r$\n설치 범위(현재 사용자/모든 사용자)와 폴더를 기존 설치와 같게 선택해 주세요." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${EndIf}
  Pop $R1
  DetailPrint "Replacing Mochi app files; preserving settings and backups."
  ClearErrors
  StrCpy $R0 0
!macroend
!endif
