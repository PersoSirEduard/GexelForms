# GexelForms
Gexel Forms is an Electron.js based contract and signature management desktop app for work at Gexel Inc. It enables the user to create and store on their network a digitals copies of  contracts. Furthermore, the app includes other features such as email notification for signaling the whole team about an exchange and an online client signing API to for distance safe agreements.


<img src="https://user-images.githubusercontent.com/59216720/125126172-b0d8a080-e0c8-11eb-8f24-90e42035706b.png" width="500">
The app consits of a search menu to explore the available documents and their status (gray, yellow, green). Additionally, there is the main form for creating the contract. Finally, there is a simple settings menu for changing emails and local paths (additional configurations can be found in `%appdata%/gexelforms/config.json`.


<img src="https://user-images.githubusercontent.com/59216720/125127379-707a2200-e0ca-11eb-9515-418f0899f90a.png" width="500">
The signature API (the online application for signing) uses the desktop application as an intermediate to access the files on the local network to avoid exposing the same network to the exterior environment and risking any major security vulnerabilities that could compromise the files.

