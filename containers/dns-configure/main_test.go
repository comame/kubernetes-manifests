package main

import (
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"
)

func TestGetDiff(t *testing.T) {
	cases := []struct {
		prev     []string
		curr     []string
		expected diff
	}{
		{
			prev: []string{"A	foo.example	192.168.0.1"},
			curr: []string{"A	foo.example	192.168.0.1"},
			expected: diff{
				Keep: []record{{
					Type:  "A",
					Name:  "foo.example",
					Value: "192.168.0.1",
				}},
			},
		}, {
			prev: nil,
			curr: []string{"A	foo.example	192.168.0.1"},
			expected: diff{
				Added: []record{{
					Type:  "A",
					Name:  "foo.example",
					Value: "192.168.0.1",
				}},
			},
		},
		{
			prev: []string{"A	foo.example	192.168.0.1"},
			curr: nil,
			expected: diff{
				Deleted: []record{{
					Type:  "A",
					Name:  "foo.example",
					Value: "192.168.0.1",
				}},
			},
		},
		{
			prev: []string{
				"A	foo.example	192.168.0.1",
				"A	foo.example	192.168.0.2",
				"A	bar.example	192.168.1.1",
			},
			curr: []string{
				"A	foo.example	192.168.0.1",
				"A	foo.example	192.168.0.3",
				"A	baz.example	192.168.2.1",
			},
			expected: diff{
				Keep: []record{{
					Type:  "A",
					Name:  "foo.example",
					Value: "192.168.0.1",
				}},
				Added: []record{{
					Type:  "A",
					Name:  "foo.example",
					Value: "192.168.0.3",
				}, {
					Type:  "A",
					Name:  "baz.example",
					Value: "192.168.2.1",
				}},
				Deleted: []record{{
					Type:  "A",
					Name:  "foo.example",
					Value: "192.168.0.2",
				}, {
					Type:  "A",
					Name:  "bar.example",
					Value: "192.168.1.1",
				}},
			},
		},
	}

	for _, c := range cases {
		_, actual := getDiff(c.prev, c.curr)
		expected := c.expected

		sortDiff(actual)
		sortDiff(&expected)
		if !reflect.DeepEqual(actual, &expected) {
			t.Logf("expect %v, actual %v", expected, &actual)
			t.Fail()
		}
	}
}

func sortDiff(d *diff) {
	sortSlice(d.Added)
	sortSlice(d.Deleted)
	sortSlice(d.Keep)
}

func sortSlice[T any](s []T) {
	slices.SortStableFunc(s, func(a, b T) int {
		return strings.Compare(fmt.Sprintf("%v", a), fmt.Sprintf("%v", b))
	})
}
