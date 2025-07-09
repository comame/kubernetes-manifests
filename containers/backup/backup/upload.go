package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"time"

	"golang.org/x/oauth2/jwt"
)

type googleServiceAccountKey struct {
	ProjectID   string `json:"project_id"`
	PrivateKey  string `json:"private_key"`
	ClientEmail string `json:"client_email"`
	TokenURL    string `json:"token_uri"`
}

type googleDriveFileMetadata struct {
	Parents []string `json:"parents,omitempty"`
	Name    string   `json:"name,omitempty"`
}

// Google Drive にファイルをアップロードする
func upload() error {
	saKeyJSON := os.Getenv("GOOGLE_SA_KEY")
	parent := os.Getenv("GOOGLE_DRIVE_PARENT_ID")

	// Service Account Key からアクセストークンを取得
	accessToken, err := getAccessToken(saKeyJSON)
	if err != nil {
		return err
	}

	ymd := time.Now().Format("2006-01-02")

	// 再開可能なリクエストのアップロードURLを取得
	metadata := googleDriveFileMetadata{
		Parents: []string{parent},
		Name:    "backup-" + ymd + ".zip",
	}
	location, err := createFileMetadata(metadata, accessToken)
	if err != nil {
		return err
	}

	// 実際にファイルをアップロード
	f, err := os.Open("/work/backup.zip")
	if err != nil {
		return err
	}
	defer f.Close()

	if err := uploadFile(location, f, accessToken); err != nil {
		return err
	}

	return nil
}

func getAccessToken(serviceAccountKeyJSON string) (string, error) {
	var saKey googleServiceAccountKey
	if err := json.Unmarshal([]byte(serviceAccountKeyJSON), &saKey); err != nil {
		return "", err
	}
	conf := &jwt.Config{
		Email:      saKey.ClientEmail,
		PrivateKey: []byte(saKey.PrivateKey),
		Scopes:     []string{"https://www.googleapis.com/auth/drive.file"},
		TokenURL:   saKey.TokenURL,
	}
	token, err := conf.TokenSource(context.Background()).Token()
	if err != nil {
		return "", err
	}

	return token.AccessToken, nil
}

func uploadFile(
	location string,
	f io.Reader,
	accessToken string,
) error {
	req, err := http.NewRequest(
		http.MethodPut,
		location,
		f,
	)
	if err != nil {
		return err
	}
	req.Header.Add("Authorization", "Bearer "+accessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	if res.StatusCode != http.StatusOK {
		return errors.New("ファイル作成時に200以外が返された")
	}

	return nil
}

func createFileMetadata(
	metadata googleDriveFileMetadata,
	accessToken string,
) (location string, err error) {
	bodyBytes, err := json.Marshal(metadata)
	if err != nil {
		return "", err
	}

	req, _ := http.NewRequest(
		http.MethodPost,
		"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
		bytes.NewBuffer(bodyBytes),
	)
	req.Header.Add("Authorization", "Bearer "+accessToken)
	req.Header.Add("Content-Type", "application/json; charset=UTF-8")
	req.Header.Add("X-Upload-Content-Type", "application/zip")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}

	if res.StatusCode != http.StatusOK {
		return "", errors.New("200以外が返された")
	}

	return res.Header.Get("Location"), nil
}
