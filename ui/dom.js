export default class DomManager {
    constructor() {
        this._storage = {
            state: {},
            values: {},
            elements: {}
        }
    }

    get state() {
        return this._storage.state;
    }

    set state(state) {
        this._storage.state = state;
    }

    get values() {
        return this._storage.values;
    }

    set value(pair) {
        this._storage.values[pair.key] = pair.value;
    }

    updateInput(node, state, error) {
        const {group, input} = node;

        switch (state.prev) {
            case 1:
                if (state.prev !== state.next) {
                    DomManager.removeSuccess(group, input);
                    DomManager.addError(group, input, error);
                }
                break;
            case 0:
                if (error !== null) {
                    DomManager.addError(group, input, error);
                } else {
                    DomManager.addSuccess(group, input);
                }
                break;
            case -1:
                if (state.prev !== state.next) {
                    DomManager.removeError(group, input);
                    DomManager.addSuccess(group, input);
                } else {
                    if (input.innerHTML !== error) {
                        DomManager.updateError(group, error);
                    }
                }
                break;
            default:
                console.log("This shouldn't ever happen. Question mark.");
        }
    }

    updateSubmitter(submitter) {
        const toIgnore = ["modal", "alert"];

        for (const key of Object.keys(this._storage.state)) {
            if (!toIgnore.includes(key) && this._storage.state[key] !== 1) {
                if (!submitter.disabled) {
                    DomManager.disableSubmitter(submitter);
                }
                return;
            }
        }

        DomManager.enableSubmitter(submitter);
    }
    
    toggleModal(form, submitter, nodes) {
        switch (this._storage.state["modal"]) {
            case 1:            
                DomManager.reset(nodes, submitter, this._storage.state);
                DomManager.closeModal(this._storage.elements["modal"]);
                this._storage.state["modal"] = -1;
                break;
            case 0:
                if (!("modal" in this._storage.elements)) {
                    this._storage.elements["modal"] = DomManager.openModal("contact-form-wrapper");
                }

                this._storage.state["modal"] = 1;
                break;
            case -1:
                DomManager.showModal(this._storage.elements["modal"]);
                this._storage.state["modal"] = 1;
                break;
        }
    }

    displayAlert(ctx, after = null) {
        const deferClose = (_ctx, after = null, time = 5000) => {
            const {alert, form} = _ctx;

            setTimeout(() => {
                this._storage.state["alert"] = -1;
                DomManager.hideAlert(alert, form);

                if (after !== null) {
                    const {callback, args} = after;
                    callback(...args);
                }
            }, time);
        };

        if (!("alert" in this._storage.elements)) {
            this._storage.elements["alert"] = DomManager.newAlert(ctx.message, ctx.type, ctx.form);
            this._storage.state["alert"] = 1;
            deferClose({alert: this._storage.elements["alert"], form: ctx.form}, after);
            return;
        }
        
        const alert = this._storage.elements["alert"];
        deferClose({alert: alert, form: ctx.form}, after);

        DomManager.showAlert(alert, ctx.message, ctx.type, ctx.form);
        this._storage.state["alert"] = 1;
    }

    static getInputGroups(elementId) {
        const form = document.getElementById(elementId), formNodes = form.childNodes;
        let nodes = [];
        let state = {};

        for (const node of formNodes) {
            if (node instanceof HTMLElement && (
                node.className === "input-group" ||
                node.classList.contains("input-group"))
            ) {
                let _node = {
                    group: node,
                    input: null
                };
                
                for (const child of node.childNodes) {
                    if (child instanceof HTMLElement && ((
                        child.tagName === "INPUT" && child.type !== "submit") ||
                        child.tagName === "TEXTAREA")
                    ) {
                        _node.input = child;

                        // I'll be using bipolar encoding to track the state of each form input
                        state[`${child.tagName.toLowerCase()}-${child.name}`] = 0;
                    }
                    continue;
                }
                
                nodes.push(_node);
            }
            continue;
        }

        return [nodes, state, form];
    }

    static onInputChange(element, callback) {
        element.addEventListener("change", callback);
    }

    static onSubmit(submitter, callback) {
        submitter.addEventListener("submit", callback);
    }

    static onClick(element, callback) {
        element.addEventListener("click", callback);
    }

    static addError(inputGroup, inputElement, error) {
        inputElement.classList.add("has-error");

        let errorNode = document.createElement("div");
        errorNode.classList.add("input-error");
        errorNode.appendChild(document.createTextNode(error));

        inputGroup.appendChild(errorNode);
    }

    static removeError(inputGroup, inputElement) {
        inputElement.classList.remove("has-error");
        
        const error = _search(inputGroup.childNodes, DomManager._isError);
        inputGroup.removeChild(error);
    }

    static updateError(inputGroup, error) {
        const _error = _search(inputGroup.childNodes, DomManager._isError);

        _error.innerHTML = error;
    }

    static addSuccess(inputGroup, inputElement) {
        inputElement.classList.add("is-alright");

        let checkmarkNode = document.createElement("div");
        checkmarkNode.classList.add("input-checkmark");

        let checkmarkSvgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        checkmarkSvgNode.setAttribute("viewBox", "0 0 130.2 130.2");
        
        let polylineNode = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polylineNode.setAttribute("points", "100.2,40.2 51.5,88.8 29.8,67.5");

        checkmarkSvgNode.appendChild(polylineNode);
        checkmarkNode.appendChild(checkmarkSvgNode);

        inputGroup.appendChild(checkmarkNode);
    }

    static removeSuccess(inputGroup, inputElement) {
        inputElement.classList.remove("is-alright");

        const checkmark = _search(inputGroup.childNodes, DomManager._isCheckmark);
        inputGroup.removeChild(checkmark);
    }

    static newSubmitter(elementId) {
        const button = document.getElementById(elementId);

        DomManager.disableSubmitter(button);

        return button;
    }

    static disableSubmitter(buttonElement) {
        buttonElement.classList.add("loading");
        buttonElement.disabled = true;
    }

    static submitting(buttonElement) {
        if (!buttonElement.disabled) {
            DomManager.disableSubmitter(buttonElement);
        }
        
        buttonElement.innerHTML = "Loading...";
    }

    static enableSubmitter(buttonElement) {
        buttonElement.classList.remove("loading");
        buttonElement.disabled = false;
    }

    static resetSubmitter(buttonElement) {
        buttonElement.innerHTML = "Send";
    }

    static newAlert(message, type, form) {
        let alertElement = document.getElementById("contact-alert");

        DomManager.showAlert(alertElement, message, type, form);

        return alertElement;
    }

    static showAlert(alertElement, message, type, form) {
        form.classList.add("hide");
        alertElement.classList.remove("hide");
        alertElement.classList.add(type);
        alertElement.innerHTML = message;
    }

    static hideAlert(alert, form) {
        form.classList.remove("hide");
        alert.classList.add("hide");
        alert.innerHTML = "";
    }

    static reset(inputNodes, submitter, state) {
        for (const {group, input} of inputNodes) {
            const key = `${input.tagName.toLowerCase()}-${input.name}`;

            switch (state[key]) {
                case 1:
                    DomManager.removeSuccess(group, input);
                    break;
                case -1:
                    DomManager.removeError(group, input);
                    break;
            }
            
            if (state[key] !== 0) state[key] = 0;
            
            input.value = "";
        }

        DomManager.resetSubmitter(submitter);
    }

    static closeModal(modalElement) {
        const body = document.body, darkBg = document.getElementById("darkener");

        body.classList.remove("modal-active");
        modalElement.classList.add("hide");
        darkBg.classList.add("hide");
    }

    static openModal(elementId) {
        const modal = document.getElementById(elementId);

        DomManager.showModal(modal);

        return modal;
    }

    static showModal(modal) {
        const body = document.body, darkBg = document.getElementById("darkener");

        modal.classList.remove("hide");
        darkBg.classList.remove("hide");
        body.classList.add("modal-active");
    }

    static button(elementId) {
        return document.getElementById(elementId);
    }

    static _isError(e) {
        return e instanceof HTMLElement && e.className === "input-error";
    }

    static _isCheckmark(e) {
        return e instanceof HTMLElement && e.className === "input-checkmark";
    }
}

const _search = (iterable, predicate) => {
    for (const i of iterable) {
        if (predicate(i)) {
            return i;
        }
    }
    return null;
};
