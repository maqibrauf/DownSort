Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd /c node src\index.js >> data\run.log 2>&1", 0, False
