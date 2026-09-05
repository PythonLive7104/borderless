package main

import "testing"

func TestMergeQuery(t *testing.T) {
	cases := []struct{ name, dest, raw, want string }{
		{"no incoming query leaves the destination alone",
			"https://form.example/s", "", "https://form.example/s"},
		{"personalised params are forwarded",
			"https://form.example/s", "rid=8842", "https://form.example/s?rid=8842"},
		{"merges with params already on the destination",
			"https://form.example/s?src=email", "rid=8842",
			"https://form.example/s?rid=8842&src=email"},
		{"incoming value wins over the destination default",
			"https://form.example/s?rid=0", "rid=8842", "https://form.example/s?rid=8842"},
		{"values are re-encoded, not injected raw",
			"https://form.example/s", "email=jane%40co.com",
			"https://form.example/s?email=jane%40co.com"},
		{"a broken destination is returned untouched",
			"://nonsense", "rid=1", "://nonsense"},
	}
	for _, c := range cases {
		if got := mergeQuery(c.dest, c.raw, nil); got != c.want {
			t.Errorf("%s:\n  got  %s\n  want %s", c.name, got, c.want)
		}
	}
}

func TestMergeQueryRejectsOversizedInput(t *testing.T) {
	// The query comes from whoever clicked the link, so it must be bounded.
	huge := make([]byte, 3000)
	for i := range huge {
		huge[i] = 'a'
	}
	dest := "https://form.example/s"
	if got := mergeQuery(dest, "x="+string(huge), nil); got != dest {
		t.Errorf("oversized query should be dropped, got %s", got)
	}
}

func TestChallengeSignatureIsStable(t *testing.T) {
	t.Setenv("DJANGO_SECRET_KEY", "test-secret")
	a, b := sign("hc-iss", 1700000000), sign("hc-iss", 1700000000)
	if a != b {
		t.Fatal("signature is not deterministic")
	}
	if sign("hc-iss", 1700000001) == a {
		t.Fatal("signature does not vary with the timestamp")
	}
}


func TestMergeQueryAllowList(t *testing.T) {
	dest := "https://form.example/s"
	raw := "email=jane%40co.com&rid=8842&fbclid=junk&utm_source=ads"

	// Only the named parameters travel; everything else is dropped.
	got := mergeQuery(dest, raw, []string{"email", "rid"})
	want := "https://form.example/s?email=jane%40co.com&rid=8842"
	if got != want {
		t.Errorf("allow-list:\n  got  %s\n  want %s", got, want)
	}

	// An empty list still means "forward everything".
	if mergeQuery(dest, "rid=1", []string{}) != "https://form.example/s?rid=1" {
		t.Error("empty allow-list should forward everything")
	}

	// A list that matches nothing forwards nothing.
	if got := mergeQuery(dest, "rid=1", []string{"email"}); got != dest {
		t.Errorf("non-matching allow-list should forward nothing, got %s", got)
	}
}


// The formats people actually type into a campaign link.
func TestMergeQueryRealWorldFormats(t *testing.T) {
	dest := "https://form.example/s"
	allow := []string{"email", "rid"}

	// An unencoded @ is fine going in — it comes out correctly encoded.
	if got := mergeQuery(dest, "email=jane@co.com", allow); got != "https://form.example/s?email=jane%40co.com" {
		t.Errorf("plain @ should be encoded, got %s", got)
	}

	// Both parameters together.
	if got := mergeQuery(dest, "email=jane@co.com&rid=8842", allow); got != "https://form.example/s?email=jane%40co.com&rid=8842" {
		t.Errorf("both params: got %s", got)
	}

	// A hyphen instead of "=" is not a parameter at all: the whole thing reads
	// as one key with an empty value, so it never matches the allow-list.
	if got := mergeQuery(dest, "rid-8842", allow); got != dest {
		t.Errorf("rid-8842 is malformed and must be dropped, got %s", got)
	}

	// Without an allow-list it still travels, but as a nonsense key.
	if got := mergeQuery(dest, "rid-8842", nil); got != "https://form.example/s?rid-8842=" {
		t.Errorf("malformed key passthrough: got %s", got)
	}
}
