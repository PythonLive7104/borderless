package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The edge-click endpoint's guards must all fire before any store access, so a
// forged or malformed request is rejected without touching Redis. A nil store
// here proves that: if any guard fell through it would panic.
func TestEdgeClickRejectsNonPost(t *testing.T) {
	h := &handler{}
	req := httptest.NewRequest(http.MethodGet, "/v1/edge-click", nil)
	rec := httptest.NewRecorder()
	h.edgeClick(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET: got %d, want 405", rec.Code)
	}
}

func TestEdgeClickRequiresSecretWhenSet(t *testing.T) {
	t.Setenv("EDGE_CLICK_SECRET", "s3cret")
	h := &handler{}
	req := httptest.NewRequest(http.MethodPost, "/v1/edge-click",
		strings.NewReader(`{"slug":"x"}`))
	rec := httptest.NewRecorder()
	h.edgeClick(rec, req) // no X-Edge-Secret header
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing secret: got %d, want 401", rec.Code)
	}
}

func TestEdgeClickRejectsBadBody(t *testing.T) {
	t.Setenv("EDGE_CLICK_SECRET", "s3cret")
	h := &handler{}
	req := httptest.NewRequest(http.MethodPost, "/v1/edge-click", strings.NewReader("not json"))
	req.Header.Set("X-Edge-Secret", "s3cret")
	rec := httptest.NewRecorder()
	h.edgeClick(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad body: got %d, want 400", rec.Code)
	}
}

func TestEdgeClickRejectsMissingSlug(t *testing.T) {
	t.Setenv("EDGE_CLICK_SECRET", "s3cret")
	h := &handler{}
	req := httptest.NewRequest(http.MethodPost, "/v1/edge-click", strings.NewReader(`{"ip":"1.2.3.4"}`))
	req.Header.Set("X-Edge-Secret", "s3cret")
	rec := httptest.NewRecorder()
	h.edgeClick(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("missing slug: got %d, want 400", rec.Code)
	}
}
