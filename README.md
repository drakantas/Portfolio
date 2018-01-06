# My portfolio

This is what I use to power my site at [http://vladimir-ibazeta.me](http://vladimir-ibazeta.me). You're free to run your own instance of it, ofc you'd need to change a couple things, most importantly `/ui/views/index.html`. 

On a good day I might have the drive to do a quick geolocalization of visitors to show them content in English or Spanish, but tbh I think this is just enough for the time being. You could say it's in a to-do list, but I don't have an ETA.


## Configuration

Create a file and name in the config directory and name it `app.json`, here you may place the configuration for the server to send emails through SMTP. Personally I'm using Gmail.

```
{
    "Hostname": "127.0.0.1",
    "Port": 80,
    "Smtp": {
        "Email": "",
        "Password": "",
        "To": "",
        "Hostname": "smtp.gmail.com",
        "Port": 587
    }
}
```
This is what it should look like, in `Email` and `Password` you have to place your credentials, because the emails will be send from that account, and in `To` you'd place the email address that will be receiving the emails.


## To do, eventually, hopefully, maybe in a good day

[ ] Localization for international users. (English).
[ ] Endpoint to read the locally stored emails. (`/storage.json`)
[ ] Make site cuter and write a few bits more about me.
[ ] Works and about me sections.
