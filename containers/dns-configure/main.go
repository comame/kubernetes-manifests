package main

import (
	"slices"
	"strings"

	_ "github.com/cloudflare/cloudflare-go"
)

func main() {}

type record struct {
	Type  string
	Name  string
	Value string
}

type config map[string][]string

type diff struct {
	Keep    []record
	Added   []record
	Deleted []record
}

var knownTypes = []string{
	"A", "CNAME", "MX", "TXT",
}

// 比較する。すべてのレコードが正しいものであると仮定する
func getDiff(prev, curr []string) (bool, *diff) {
	var diff diff

	am := make(map[string]struct{})
	bm := make(map[string]struct{})

	for _, v := range prev {
		am[v] = struct{}{}
	}
	for _, v := range curr {
		bm[v] = struct{}{}
	}

	for l := range am {
		if _, ok := bm[l]; !ok {
			continue
		}

		// a, b で重複したレコードは維持する
		entry, _ := parseRecord(l)
		diff.Keep = append(diff.Keep, *entry)

		// 重複レコードは消しておく
		delete(am, l)
		delete(bm, l)
	}

	for l := range am {
		entry, _ := parseRecord(l)
		diff.Deleted = append(diff.Deleted, *entry)
	}
	for l := range bm {
		entry, _ := parseRecord(l)
		diff.Added = append(diff.Added, *entry)
	}

	return true, &diff
}

// `TYPE	name	value` 形式のレコードをパース
func parseRecord(s string) (r *record, ok bool) {
	parts := strings.Split(s, "\t")
	if len(parts) != 3 {
		return nil, false
	}

	typ := parts[0]
	name := parts[1]
	value := parts[2]

	if !slices.Contains(knownTypes, typ) {
		return nil, false
	}

	return &record{
		Type:  typ,
		Name:  name,
		Value: value,
	}, true
}
