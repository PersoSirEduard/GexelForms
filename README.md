# GexelForms

## Description
Gexel Forms is an Electron.js based contract and signature manager for desktop. It was created for Gexel Inc. and it enables the users to create and store digital contracts on their network. Furthermore, the app includes other features such as an email notification system for signaling the whole team about an exchange and an online client signing API for distance safe agreements.


<img src="https://i.imgur.com/BjsjvIk.png" width="500">
The app consits of a search menu to explore the available documents and their status (gray, yellow, green). Additionally, there is the main form for creating the contract. Finally, there is a simple settings menu for changing emails and local paths (additional configurations can be found in `%appdata%/gexelforms/config.json`



---

## Architecture
<img src="https://user-images.githubusercontent.com/59216720/125127379-707a2200-e0ca-11eb-9515-418f0899f90a.png" width="500">
The signature API (the online application for signing) uses the desktop application as an intermediate to access the files on the local network to avoid exposing the same network to the exterior environment and risking any major security vulnerabilities that could compromise the files.

