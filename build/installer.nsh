!macro customInit
  ; Terminate any existing running instances before install or update
  nsExec::Exec 'taskkill /F /IM "YOVY-NAV.exe" /T'
  nsExec::Exec 'taskkill /F /IM "Yovy-helper.exe" /T'
  Sleep 500
!macroend

!macro customUnInit
  ; Terminate running processes before uninstallation so files are not locked
  nsExec::Exec 'taskkill /F /IM "YOVY-NAV.exe" /T'
  nsExec::Exec 'taskkill /F /IM "Yovy-helper.exe" /T'
  Sleep 500
!macroend

!macro customUnInstall
  ; Remove startup shortcut if present
  Delete "$SMSTARTUP\YOVY-NAV.lnk"
!macroend
