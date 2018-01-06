import XRegExp from "xregexp";
import DomManager from "./dom";

export default class ContactFormManager {
    constructor(httpClient) {
        this._dom = new DomManager();

        this._http = httpClient;

        this._regexPatterns = {
            sentence: new RegexValidator(
                "^[\\p{L}\\d\\x20-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E\u00B4]*$",
                //"must only contain language letters and ascii symbols"
                "solo debe contener caracteres del idioma y símbolos ascii"
            ),
            name: new RegexValidator(
                "^\\p{L}{2,}(?:\\x20\\p{L}{2,}){1,5}$",
                //"has to have at least one middle or last name"
                "debe tener por lo menos un apellido"
            ),
            email: new RegexValidator(
                "^[a-z\\x2E\\x5F]+\\x2B?[a-z]*[^\\x2B]\\x40(?:[a-z]+[a-z\\x2D\\x2E]?)+[^\\x2D]\\x2E[a-z]{2,5}$",
                //"must be a valid email address"
                "debe ser un correo electrónico válido"
            ),
            message: new RegexValidator(
                "^[\\p{L}\\d\\x20-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E\u00B4\\s]+$",
                //"must only contain language letters and ascii symbols"
                "debe contener solo caracteres del idioma y símbolos ascii"
            )
        };

        this._rules = {
            subject: {
                len: {
                    min: 12,
                    max: 128
                },
                regex: this._regexPatterns.sentence,
                //name: "Subject"
                name: "Asunto"
            },
            fullname: {
                len: {
                    min: 5,
                    max: 48
                },
                regex: this._regexPatterns.name,
                //name: "Full name"
                name: "Nombres completos"
            },
            email: {
                len: {
                    min: 12,
                    max: 128
                },
                regex: this._regexPatterns.email,
                //name: "Email"
                name: "Correo electrónico"
            },
            business: {
                len: {
                    min: 3,
                    max: 32
                },
                regex: this._regexPatterns.sentence,
                //name: "Business"
                name: "Empresa"
            },
            body: {
                len: {
                    min: 64,
                    max: 4096
                },
                regex: this._regexPatterns.message,
                //name: "Message"
                name: "Mensaje"
            },
            details: {
                len: {
                    min: 4,
                    max: 1024
                },
                regex: this._regexPatterns.message,
                //name: "Additional details"
                name: "Detalles adicionales"
            }
        };
    }

    register() {
        let modal, nodes, form,
            submit = DomManager.newSubmitter("submit-form"),
            modalToggler = DomManager.button("mail-me"),
            closeModal = DomManager.button("close-modal");

        [nodes, this._dom.state, form] = DomManager.getInputGroups("contact-form");

        for (const k of ["alert", "modal"]) {
            this._dom.state[k] = 0;
        }

        DomManager.onClick(modalToggler, (event) => {
            event.preventDefault();

            this._dom.toggleModal(form, submit, nodes);
        });

        DomManager.onClick(closeModal, () => {
            this._dom.toggleModal(form, submit, nodes);
        });

        for (const node of nodes) {
            DomManager.onInputChange(node.input, () => {
                const rule  = this._rules[node.input.name],
                      key   = `${node.input.tagName.toLowerCase()}-${node.input.name}`,
                      error = validate(rule.name, node.input.value, rule.len, rule.regex),
                      state = {prev: this._dom.state[key], next: 0};

                this._dom.value = {key: node.input.name, value: node.input.value};

                if (error !== null) {
                    this._dom.state[key] = state.next = -1;
                } else {
                    this._dom.state[key] = state.next = 1;
                }

                this._dom.updateInput(node, state, error);
                this._dom.updateSubmitter(submit);
            });
        }

        DomManager.onSubmit(form, (event) => {
            event.preventDefault();

            DomManager.submitting(submit);

            this._http.post("/write-email", JSON.stringify(this._dom.values))
                      .then((response) => {
                          this._dom.displayAlert({
                              //message: "The email has been sent successfully.",
                              message: "El correo electrónico fue enviado exitosamente",
                              type: "success",
                              form: form
                            }, {
                                callback: DomManager.reset,
                                args: [nodes, submit, this._dom.state]
                            });
                        })
                        .catch((error) => {
                            const response = error.response;
                            
                            if (typeof response === "undefined") {
                                this._dom.displayAlert({
                                    //message: "Oops, something went wrong. Please try again in a couple minutes.",
                                    message: "Oops... Also salió mal. Intentalo dentro de unos minutos.",
                                    type: "error",
                                    form: form
                                });
                                return;
                            }
                            
                            this._dom.displayAlert({
                                //message: "Ay! Something happened with the server, please try again later.",
                                message: "Ay! Algo sucedió con el servidor, por favor inténtalo de nuevo más tarde.",
                                type: "error", 
                                form: form
                            });
                     });
        });
    }
}


class RegexValidator {
    constructor(pattern, errorMessage) {
        this._pattern = XRegExp(pattern);
        this._error = errorMessage;
    }

    validate(name, value) {
        return (this._pattern.test(value)) ? true : `${name} ${this._error}`;
    }
}


const validate = (name, value, length, regexValidator = null) => {
    let error;
    const valLen = value.length;

    if (valLen < length.min || valLen > length.max)
        //return `${name} length mustn't be shorter than ${length.min} characters or longer than ${length.max} characters`;
        return `${name} no puede tener menos de ${length.min} caracteres o más de ${length.max} caracteres`;

    if (regexValidator !== null) {
        error = regexValidator.validate(name, value);

        if (typeof error === "string") {
            return error;
        }
    }

    return null;
};
