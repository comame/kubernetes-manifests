package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strconv"

	"github.com/goccy/go-yaml"
)

var excludeNamespaces = []string{
	"calico-apiserver",
	"calico-system",
	"cert-manager",
	"ingress-nginx",
	"metallb-system",
	"tigera-operator",
}

var excludeTypes = []string{
	"kubernetes.io/tls",
	"kubernetes.io/dockerconfigjson",
}

// kubernetes の secrets を取得
func secrets() error {
	conf, err := createAPIConfig()
	if err != nil {
		return err
	}

	var saveSecrets []kubernetesSecret

	namespaceList, err := getKubernetesAPI[kubernetesNamespaceList]("/api/v1/namespaces", *conf)
	if err != nil {
		return err
	}
	for _, namespace := range namespaceList.Items {
		if slices.Contains(excludeNamespaces, namespace.Metadata.Name) {
			continue
		}

		secretList, err := getKubernetesAPI[kubernetesSecretList](
			fmt.Sprintf("/api/v1/namespaces/%s/secrets", namespace.Metadata.Name),
			*conf,
		)
		if err != nil {
			return err
		}

		for _, secret := range secretList.Items {
			if slices.Contains(excludeTypes, secret.Type) {
				continue
			}

			saveSecrets = append(saveSecrets, secret)
		}
	}

	for _, secret := range saveSecrets {
		// kind がなぜか入っていないので、手動で設定
		secret.Kind = "Secret"

		m, err := yaml.Marshal(secret)
		if err != nil {
			return fmt.Errorf("failed to marshal secret %s: %w", secret.Metadata.Name, err)
		}

		os.Stdout.Write([]byte("\n---\n"))
		os.Stdout.Write(m)
	}

	return nil
}

type kubernetesNamespaceList struct {
	Kind  string                `json:"kind" yaml:"kind"`
	Items []kubernetesNamespace `json:"items" yaml:"items"`
}

type kubernetesNamespace struct {
	Metadata kubernetesMetadata `json:"metadata" yaml:"metadata"`
	Kind     string             `json:"kind" yaml:"kind"`
}

type kubernetesSecretList struct {
	Kind  string             `json:"kind" yaml:"kind"`
	Items []kubernetesSecret `json:"items" yaml:"items"`
}

type kubernetesSecret struct {
	Metadata kubernetesMetadata `json:"metadata" yaml:"metadata"`
	Kind     string             `json:"kind" yaml:"kind"`
	Data     map[string]string  `json:"data" yaml:"data"`
	Type     string             `json:"type" yaml:"type"`
}

type kubernetesMetadata struct {
	Name      string `json:"name" yaml:"name"`
	Namespace string `json:"namespace" yaml:"namespace"`
}

type kubernetesAPIConfig struct {
	Host     string
	Port     int
	CertPool *x509.CertPool
	Token    string
}

func createAPIConfig() (*kubernetesAPIConfig, error) {
	crtPath := os.Getenv("KUBERNETES_CERT_PATH")
	if crtPath == "" {
		crtPath = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
	}

	cert, err := getKubernetesCertificate(crtPath)
	if err != nil {
		return nil, err
	}

	host := os.Getenv("KUBERNETES_SERVICE_HOST")
	if host == "" {
		host = "kubernetes.default.svc"
	}

	port := os.Getenv("KUBERNETES_SERVICE_PORT")
	if port == "" {
		port = "443"
	}
	portInt, err := strconv.Atoi(port)
	if err != nil {
		return nil, errors.New("invalid KUBERNETES_SERVICE_PORT: " + port)
	}

	token := os.Getenv("KUBERNETES_TOKEN")
	if token == "" {
		tokenPath := "/var/run/secrets/kubernetes.io/serviceaccount/token"
		tokenBytes, err := os.ReadFile(tokenPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read token from %s: %w", tokenPath, err)
		}
		token = string(tokenBytes)
	}

	return &kubernetesAPIConfig{
		Host:     host,
		Port:     portInt,
		CertPool: cert,
		Token:    token,
	}, nil
}

func getKubernetesCertificate(path string) (*x509.CertPool, error) {
	f, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(f); !ok {
		return nil, fmt.Errorf("failed to parse certificate from %s", path)
	}

	return pool, nil
}

func getKubernetesAPI[T any](path string, conf kubernetesAPIConfig) (T, error) {
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				RootCAs: conf.CertPool,
			},
		},
	}

	url := fmt.Sprintf("https://%s:%d%s", conf.Host, conf.Port, path)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Add("Authorization", "Bearer "+conf.Token)

	var obj T

	res, err := client.Do(req)
	if err != nil {
		return obj, err
	}

	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return obj, err
	}

	if res.StatusCode != http.StatusOK {
		return obj, fmt.Errorf("unexpected status code: %d, response: %s", res.StatusCode, string(resBody))
	}

	if err := json.Unmarshal(resBody, &obj); err != nil {
		return obj, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return obj, nil
}
