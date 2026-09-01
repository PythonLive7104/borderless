package geo

import (
	"io"
	"net/http"
	"time"
)

func httpGet(url string) (io.ReadCloser, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "TrackAudit/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		resp.Body.Close()
		return nil, io.EOF
	}
	return resp.Body, nil
}
