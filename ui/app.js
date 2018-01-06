require("./styles");
import axios from "axios";
import ContactFormManager from "./contact_form";

class Application {
    constructor() {
        this.http = axios.create({
            baseURL: "http://127.0.0.1/",
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
