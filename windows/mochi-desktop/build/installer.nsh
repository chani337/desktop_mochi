# Use the bundled native plugin, without PowerShell or folder-prefix matching.
!macro customCheckAppRunning
  # This hook expands after installUtil.nsh has defined its macros. Replace only
  # the upgrade step; keep electron-builder's generated installer/uninstaller.
  !ifndef BUILD_UNINSTALLER
    !include "${BUILD_RESOURCES_DIR}/recovery-upgrade.nsh"
  !endif
  Push $R0
  Push $R1
  StrCpy $R1 0
  ${Do}
    ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 603
      ${ExitDo}
    ${EndIf}
    ${If} $R0 != 0
    ${OrIf} $R1 >= 3
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Mochi could not be closed. Exit Mochi from the tray, then choose Retry." /SD IDCANCEL IDRETRY +3
      ${nsProcess::Unload}
      Quit
      StrCpy $R1 0
    ${Else}
      DetailPrint "Closing Mochi before installation..."
      ${If} $R1 == 0
        ${nsProcess::CloseProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${Else}
        ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${EndIf}
      IntOp $R1 $R1 + 1
      Sleep 1000
    ${EndIf}
  ${Loop}
  ${nsProcess::Unload}
  Pop $R1
  Pop $R0
!macroend
