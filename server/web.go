package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/smtp"
	"os"
	"reflect"
	"regexp"
	"strconv"
	"sync"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	log "github.com/sirupsen/logrus"
)

type Mail struct {
	Subject           string `json:"subject"`
	FullName          string `json:"fullname"`
	Email             string `json:"email"`
	Business          string `json:"business"`
	Body              string `json:"body"`
	AdditionalDetails string `json:"details"`
}

type Config struct {
	Smtp     *Smtp
	Cwd      string
	Hostname string
	Port     int
}

type Smtp struct {
	Email    string
	To       string
	Password string
	Hostname string
	Port     int
}

type FieldLength struct {
	Min int
	Max int
}

type FieldRegex struct {
	Pattern string
	Error   string
}

type Field struct {
	Name        string
	DisplayName string
	Value       string
	Length      *FieldLength
	Regex       *FieldRegex
}

const (
	// Regex patterns for the inputted fields
	VALID_NAME     string = "^\\p{L}{2,}(?:\\x20\\p{L}{2,}){1,5}$"
	VALID_SENTENCE string = "^[\\p{L}\\d\\x20-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E\\x{00B4}]*$"
	VALID_MESSAGE  string = "^[\\p{L}\\d\\x20-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E\\x{00B4}\\s]+$"
	// This email regex has to get better, missing _ and a proper . check before the @
	VALID_EMAIL string = "^[a-z\\x2E\\x5F]+\\x2B?[a-z]*[^\\x2B]\\x40(?:[a-z]+[a-z\\x2D\\x2E]?)+[^\\x2D]\\x2E[a-z]{2,5}$"

	// Validation errors
	EMAIL_ERROR    string = "%s must be a valid email address"
	NAME_ERROR     string = "%s has to have at least one middle or last name"
	SENTENCE_ERROR string = "%s must only contain language letters and ascii symbols"
	LENGTH_ERROR   string = "%s length mustn't be shorter than %d characters or longer than %d characters"

	// Validations were successful
	SUCCESS_MSG string = "Alright! The email has been sent."

	// Amount of bytes to read from the body of a request
	PAYLOAD_MAX_SIZE int64 = 8192
)

var (
	config *Config

	homepage *[]byte

	cwd *string

	mailmu sync.Mutex
)

// Concatenate a given hostname and port
func GetAddress(h *string, p *int) string {
	return *h + ":" + strconv.FormatUint(uint64(*p), 10)
}

// Append an error message to slice if value fails the checks
func validateField(f *Field, hash map[string]string) {
	length := 0

	if f.Value != "" {
		length = len(f.Value)
	}

	switch {
	case length < f.Length.Min || length > f.Length.Max:
		hash[f.Name] = fmt.Sprintf(LENGTH_ERROR, f.DisplayName, f.Length.Min, f.Length.Max)
	case f.Regex != nil:
		matches, _ := regexp.MatchString(f.Regex.Pattern, f.Value)

		if !matches {
			hash[f.Name] = fmt.Sprintf(f.Regex.Error, f.DisplayName)
		}
	}
}

// Encode content to JSON and write it to the response
func JSONResponse(w http.ResponseWriter, content interface{}, statusCode int) {
	resp, err := json.Marshal(content)

	if err != nil {
		http.Error(w, "Failed to encode content to JSON", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
	w.WriteHeader(statusCode)
	w.Write(resp)
}

func (c *Config) Populate() {
	content, err := ioutil.ReadFile(path("/config/app.json"))

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Fatal("Couldn't read file /config/app.json")
	}

	if err := json.Unmarshal(content, &c); err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Fatal("Failed to decode config.json")
	}
}

func path(p string) string {
	return *cwd + p
}

func (m *Mail) Validate() map[string]string {
	errors := make(map[string]string)

	validateField(&Field{
		Name:        "subject",
		DisplayName: "Subject",
		Value:       m.Subject,
		Length: &FieldLength{
			Min: 12,
			Max: 128,
		},
		Regex: &FieldRegex{
			Pattern: VALID_SENTENCE,
			Error:   SENTENCE_ERROR,
		},
	}, errors)

	validateField(&Field{
		Name:        "fullname",
		DisplayName: "Full name",
		Value:       m.FullName,
		Length: &FieldLength{
			Min: 5,
			Max: 48,
		},
		Regex: &FieldRegex{
			Pattern: VALID_NAME,
			Error:   NAME_ERROR,
		},
	}, errors)

	validateField(&Field{
		Name:        "email",
		DisplayName: "Email",
		Value:       m.Email,
		Length: &FieldLength{
			Min: 12,
			Max: 128,
		},
		Regex: &FieldRegex{
			Pattern: VALID_EMAIL,
			Error:   EMAIL_ERROR,
		},
	}, errors)

	validateField(&Field{
		Name:        "business",
		DisplayName: "Business",
		Value:       m.Business,
		Length: &FieldLength{
			Min: 3,
			Max: 32,
		},
		Regex: &FieldRegex{
			Pattern: VALID_SENTENCE,
			Error:   SENTENCE_ERROR,
		},
	}, errors)

	validateField(&Field{
		Name:        "body",
		DisplayName: "Message",
		Value:       m.Body,
		Length: &FieldLength{
			Min: 64,
			Max: 4096,
		},
		Regex: &FieldRegex{
			Pattern: VALID_MESSAGE,
			Error:   SENTENCE_ERROR,
		},
	}, errors)

	validateField(&Field{
		Name:        "details",
		DisplayName: "Additional details",
		Value:       m.AdditionalDetails,
		Length: &FieldLength{
			Min: 4,
			Max: 1024,
		},
		Regex: &FieldRegex{
			Pattern: VALID_MESSAGE,
			Error:   SENTENCE_ERROR,
		},
	}, errors)

	return errors
}

func (m *Mail) Send() {
	err := smtp.SendMail(
		GetAddress(&config.Smtp.Hostname, &config.Smtp.Port),
		smtp.PlainAuth("", config.Smtp.Email, config.Smtp.Password, config.Smtp.Hostname),
		config.Smtp.Email, []string{config.Smtp.To}, []byte(m.Body))

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Error(fmt.Sprintf("Failed to send email from <%s> to <%s>", config.Smtp.Email, config.Smtp.To))
	}

	log.WithFields(log.Fields{
		"action": "Send email",
	}).Info(fmt.Sprintf("Successfully sent email written by %s <%s>", m.FullName, m.Email))
}

func (m *Mail) Save() {
	mailmu.Lock()
	defer mailmu.Unlock()

	info, err := os.Stat(path("/storage.json"))

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Error("Failed to fetch info of storage.json")
	}

	file, err := os.OpenFile(path("/storage.json"), os.O_RDWR, 0600)
	defer file.Close()

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Error("Failed to open storage.json")
	}

	mail, _ := json.Marshal(m)

	buffer := make([]byte, 2)

	var toWrite []byte

	if _, err = file.ReadAt(buffer, info.Size()-2); err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Error("Failed to read file storage.json")
	}

	switch {
	case reflect.DeepEqual(buffer, []byte{'[', ']'}):
		toWrite = append(toWrite, mail...)
	case reflect.DeepEqual(buffer, []byte{'}', ']'}):
		toWrite = append(toWrite, append([]byte{','}, mail...)...)
	}

	if _, err = file.WriteAt(append(toWrite, ']'), info.Size()-1); err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Error("Failed to save email in storage.json")
	}

	log.WithFields(log.Fields{
		"action": "Save email",
	}).Info(fmt.Sprintf("Successfully saved email written by %s <%s>", m.FullName, m.Email))
}

func (m *Mail) SaveAndSend() {
	m.Save()
	m.Send()
}

func handleWriteEmail(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(io.LimitReader(r.Body, PAYLOAD_MAX_SIZE))

	if err != nil {
		http.Error(w, "Failed to read body from HTTP request", http.StatusInternalServerError)
		return
	}

	mail := new(Mail)

	err = json.Unmarshal(body, &mail)

	if err != nil {
		http.Error(w, "Failed to parse payload", http.StatusBadRequest)
		return
	}

	validationErrors := mail.Validate()

	if len(validationErrors) != 0 {
		JSONResponse(w, map[string](map[string]string){"errors": validationErrors}, http.StatusBadRequest)
		return
	}

	go mail.SaveAndSend()

	w.WriteHeader(200)
}

func handleHomepage(w http.ResponseWriter, _ *http.Request) {
	w.Write(*homepage)
}

func createIfNotExists(p string, content []byte) {
	if _, err := os.Stat(p); os.IsNotExist(err) {
		err = ioutil.WriteFile(p, content, 0600)

		if err != nil {
			log.WithFields(log.Fields{
				"error": err.Error(),
			}).Fatal("Failed to create new file " + p)
		}
	}
}

func bootstrap() *os.File {
	wd, err := os.Getwd()

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Fatal("Failed to retrieve the current working directory")
	}

	cwd = &wd

	// Create storage for mails as backup and to double check sent mails
	createIfNotExists(path("/storage.json"), []byte{'[', ']'})

	// Create log files, logging is gud
	createIfNotExists(path("/logs/actions.log"), nil)
	createIfNotExists(path("/logs/requests.log"), nil)

	// Create config file
	createIfNotExists(path("/config/app.json"), []byte{'{', '}'})

	// Initialize logger and write new entries to /logs/actions.log
	logFile, err := os.OpenFile(path("/logs/actions.log"), os.O_APPEND|os.O_WRONLY, 0600)

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Fatal("Failed to open file /logs/actions.log")
	}

	log.SetOutput(logFile)
	log.SetLevel(log.DebugLevel)

	// Allocate and initialize config
	config = new(Config)

	config.Populate()

	return logFile
}

func server() {
	cachedHomepage, err := ioutil.ReadFile(path("/ui/views/index.html"))

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Fatal("Failed to open homepage")
	}

	homepage = &cachedHomepage

	router := mux.NewRouter()
	addr := GetAddress(&config.Hostname, &config.Port)

	router.HandleFunc("/", handleHomepage).Methods("GET")
	router.HandleFunc("/write-email", handleWriteEmail).Methods("POST")
	router.PathPrefix("/static").Handler(http.StripPrefix("/static", http.FileServer(http.Dir(path("/build")))))

	log.Info("Starting HTTP server on " + addr)
	fmt.Println("Starting HTTP server on " + addr)

	logFile, err := os.OpenFile(path("/logs/requests.log"), os.O_APPEND|os.O_WRONLY, 0600)

	if err != nil {
		log.WithFields(log.Fields{
			"error": err.Error(),
		}).Fatal("Failed to open file /logs/requests.log")
	}

	defer logFile.Close()

	logger := handlers.LoggingHandler(logFile, router)

	log.Fatal(http.ListenAndServe(addr, logger))
}

func main() {
	logger := bootstrap()
	defer logger.Close()

	server()
}
