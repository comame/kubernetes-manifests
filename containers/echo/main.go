package main

import "net/http"

func main() {
	http.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		xForwardedFor := r.Header.Get("X-Forwarded-For")
		w.Write([]byte(xForwardedFor))
	})

	http.ListenAndServe(":8080", nil)
}
