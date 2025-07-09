package main

import (
	"flag"
)

var commands = map[string]func() error{
	"upload":  upload,
	"secrets": secrets,
}

func main() {
	flag.Parse()
	command := flag.Arg(0)

	f, ok := commands[command]
	if !ok {
		panic("unknown command: " + command)
	}
	if err := f(); err != nil {
		panic(err)
	}
}
