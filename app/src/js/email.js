async function sendEmail(to, msg) {

    return new Promise((resolve, reject) => {

        var transporter = nodemailer.createTransport({
            service: "Outlook365",
            auth: {
              user: remote.app.store.get("email"),
              pass: remote.app.store.get("password")
            }
        });
    
        var mailOptions = {
            from: remote.app.store.get("email"),
            to: to,
            subject: msg.subject,
            text: msg.text,
            html: msg.html,
            attachments: msg.attachments
        };
    
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                localLog("(Mailing) " + error);
                reject(error);
            } else {
                resolve(info);
            }
          });
    });
}