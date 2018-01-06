require("./styles");
import axios from "axios";
import ContactFormManager from "./contact_form";

class Application {
    constructor() {
        this.baseURL = `${document.location.protocol}//${document.location.host}`;

        this.http = axios.create({
            baseURL: this.baseURL,
            timeout: 5000,
            responseType: "json"
        });

        this.CFM = new ContactFormManager(this.http);
    }

    init() {
        this.CFM.register();
    }
}

const app = new Application();
app.init();
