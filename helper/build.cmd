@echo off
rem Builds Yovy-helper.exe with the C# compiler that ships with Windows (.NET Framework 4, C# 5).
setlocal
cd /d "%~dp0"
set "FW=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319"
set "WM=%WINDIR%\System32\WinMetadata"
"%FW%\csc.exe" -nologo -optimize+ -platform:x64 -target:exe -out:Yovy-helper.exe ^
  -r:"%FW%\System.Runtime.dll" -r:"%FW%\System.Management.dll" -r:"%FW%\System.Xml.dll" -r:"%FW%\System.Core.dll" ^
  -r:"%FW%\Microsoft.CSharp.dll" -r:"%FW%\WPF\UIAutomationClient.dll" -r:"%FW%\WPF\UIAutomationTypes.dll" -r:"%FW%\WPF\WindowsBase.dll" ^
  -r:"%WM%\Windows.Foundation.winmd" -r:"%WM%\Windows.Media.winmd" -r:"%WM%\Windows.Storage.winmd" ^
  YovyHelper.cs Apps.cs YtUrl.cs AddressBar.cs
exit /b %errorlevel%
