function localLog(msg) {
    fs.appendFile(remote.app.getPath('userData') + '\\log.txt', `\n[${(new Date()).toLocaleString('en-US')}]: ${msg}`, (err) => {
        if (err) {
            console.log("Error: Could not save into logs.");
        } else {
            console.log("Saved output to logs.");
        }
    })
}