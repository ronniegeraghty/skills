# Azure SDK MCP Adoption Report

> Generated: Jan 20, 2026

This report shows MCP (Model Context Protocol) tool usage for Azure SDK releases.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Telemetry Period** | 2025-10-15 to 2026-01-16 |
| **Release Month(s)** | 2026-01 |
| **Total Releases** | 92 |
| **Releases with MCP Usage** | 16 (17.39%) |

---

## MCP Adoption Overview

**16** of **92** releases (**17.39%**) had MCP tool usage during development.

### By Language

![MCP Adoption by Language](https://quickchart.io/chart?c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27DOTNET%27%2C%27PYTHON%27%2C%27GO%27%2C%27JS%27%2C%27CPP%27%5D%2Cdatasets%3A%5B%7Blabel%3A%27With+MCP+Usage%27%2Cdata%3A%5B4%2C5%2C3%2C3%2C1%5D%2CbackgroundColor%3A%27rgba%2854%2C+162%2C+235%2C+0.9%29%27%7D%2C%7Blabel%3A%27Total+Releases%27%2Cdata%3A%5B25%2C22%2C22%2C16%2C7%5D%2CbackgroundColor%3A%27rgba%28201%2C+203%2C+207%2C+0.9%29%27%7D%5D%7D%2Coptions%3A%7Bplugins%3A%7Btitle%3A%7Bdisplay%3Atrue%2Ctext%3A%27MCP+Adoption+by+Language%27%7D%2Cdatalabels%3A%7Bdisplay%3Atrue%2Canchor%3A%27end%27%2Calign%3A%27top%27%2Ccolor%3A%27%23333%27%2Cfont%3A%7Bweight%3A%27bold%27%7D%7D%7D%2Cscales%3A%7By%3A%7BbeginAtZero%3Atrue%7D%7D%7D%7D&w=600&h=400&ref=qc-js&bkg=white&f=png&v=2.9.4)

| Language | Total Releases | With MCP | Adoption Rate |
|----------|----------------|----------|---------------|
| dotnet | 25 | 4 | 16% |
| python | 22 | 5 | 22.73% |
| go | 22 | 3 | 13.64% |
| js | 16 | 3 | 18.75% |
| cpp | 7 | 1 | 14.29% |

### By Release Type

![MCP Adoption by Version Type](https://quickchart.io/chart?c=%7Btype%3A%27bar%27%2Cdata%3A%7Blabels%3A%5B%27GA%27%2C%27Beta%27%5D%2Cdatasets%3A%5B%7Blabel%3A%27With+MCP+Usage%27%2Cdata%3A%5B6%2C10%5D%2CbackgroundColor%3A%27rgba%2854%2C+162%2C+235%2C+0.9%29%27%7D%2C%7Blabel%3A%27Total+Releases%27%2Cdata%3A%5B60%2C32%5D%2CbackgroundColor%3A%27rgba%28201%2C+203%2C+207%2C+0.9%29%27%7D%5D%7D%2Coptions%3A%7Bplugins%3A%7Btitle%3A%7Bdisplay%3Atrue%2Ctext%3A%27MCP+Adoption+by+Release+Type%27%7D%2Cdatalabels%3A%7Bdisplay%3Atrue%2Canchor%3A%27end%27%2Calign%3A%27top%27%2Ccolor%3A%27%23333%27%2Cfont%3A%7Bweight%3A%27bold%27%7D%7D%7D%2Cscales%3A%7By%3A%7BbeginAtZero%3Atrue%7D%7D%7D%7D&w=600&h=400&ref=qc-js&bkg=white&f=png&v=2.9.4)

| Type | Total Releases | With MCP | Adoption Rate |
|------|----------------|----------|---------------|
| GA | 60 | 6 | 10% |
| Beta | 32 | 10 | 31.25% |

### By Plane (Management vs Data)

![Releases by Plane](https://quickchart.io/chart?c=%7Btype%3A%27doughnut%27%2Cdata%3A%7Blabels%3A%5B%27Data+%285%2F51%29%27%2C%27Management+%2811%2F41%29%27%5D%2Cdatasets%3A%5B%7Bdata%3A%5B51%2C41%5D%2CbackgroundColor%3A%5B%27rgba%2854%2C+162%2C+235%2C+0.8%29%27%2C%27rgba%28255%2C+99%2C+132%2C+0.8%29%27%5D%7D%5D%7D%2Coptions%3A%7Bplugins%3A%7Btitle%3A%7Bdisplay%3Atrue%2Ctext%3A%27Releases+by+Plane%27%7D%7D%7D%7D&w=600&h=400&ref=qc-js&bkg=white&f=png&v=2.9.4)

| Plane | Total Releases | With MCP | Adoption Rate |
|-------|----------------|----------|---------------|
| Data | 51 | 5 | 9.8% |
| Management | 41 | 11 | 26.83% |

---

## Released Packages with MCP Usage

The following **16** packages released in 2026-01 used AzSDK MCP tools during development:

### PYTHON (5 packages)

**azure-mgmt-containerservicefleet** v4.0.0b2
- Type: Beta | Plane: Management
- MCP Calls: **9**
- Tools Used: `run_generate_sdk`
- Clients Used: github-copilot-developer

**azure-mgmt-avs** v10.0.0
- Type: GA | Plane: Management
- MCP Calls: **8**
- Tools Used: `check_package_release_readiness`, `release_sdk`
- Clients Used: Visual Studio Code

**azure-mgmt-resourceconnector** v2.0.0b1
- Type: Beta | Plane: Management
- MCP Calls: **3**
- Tools Used: `release_sdk`
- Clients Used: Visual Studio Code

**azure-ai-projects** v2.0.0b3
- Type: Beta | Plane: Data
- MCP Calls: **1**
- Tools Used: `package_update_metadata`
- Clients Used: Visual Studio Code

**azure-storage-blob** v12.28.0
- Type: GA | Plane: Data
- MCP Calls: **1**
- Tools Used: `check_package_release_readiness`
- Clients Used: Visual Studio Code

### DOTNET (4 packages)

**Azure.ResourceManager.EdgeActions** v1.0.0-beta.1
- Type: Beta | Plane: Management
- MCP Calls: **15**
- Tools Used: `run_generate_sdk`
- Clients Used: github-copilot-developer

**Azure.ResourceManager.ConnectedCache** v1.0.0-beta.2
- Type: Beta | Plane: Management
- MCP Calls: **5**
- Tools Used: `run_generate_sdk`
- Clients Used: github-copilot-developer

**Azure.AI.Projects** v1.2.0-beta.5
- Type: Beta | Plane: Data
- MCP Calls: **1**
- Tools Used: `package_update_metadata`
- Clients Used: Visual Studio Code

**Azure.ResourceManager.Dell.Storage** v1.0.0
- Type: GA | Plane: Management
- MCP Calls: **1**
- Tools Used: `check_package_release_readiness`
- Clients Used: Visual Studio Code

### JS (3 packages)

**@azure/arm-containerservicefleet** v2.1.0-beta.2
- Type: Beta | Plane: Management
- MCP Calls: **9**
- Tools Used: `run_generate_sdk`
- Clients Used: github-copilot-developer

**@azure/arm-avs** v7.1.0
- Type: GA | Plane: Management
- MCP Calls: **5**
- Tools Used: `release_sdk`, `check_package_release_readiness`
- Clients Used: Visual Studio Code

**@azure/ai-projects** v2.0.0-beta.3
- Type: Beta | Plane: Data
- MCP Calls: **1**
- Tools Used: `package_update_metadata`
- Clients Used: Visual Studio Code

### GO (3 packages)

**sdk/resourcemanager/containerservicefleet/armcontainerservicefleet** v3.0.0-beta.2
- Type: Beta | Plane: Management
- MCP Calls: **9**
- Tools Used: `run_generate_sdk`
- Clients Used: github-copilot-developer

**sdk/resourcemanager/resourceconnector/armresourceconnector** v1.2.0-beta.1
- Type: Beta | Plane: Management
- MCP Calls: **4**
- Tools Used: `release_sdk`
- Clients Used: Visual Studio Code

**sdk/resourcemanager/avs/armavs** v2.2.0
- Type: GA | Plane: Management
- MCP Calls: **3**
- Tools Used: `release_sdk`, `check_package_release_readiness`
- Clients Used: Visual Studio Code

### CPP (1 packages)

**azure-identity** v1.13.3
- Type: GA | Plane: Data
- MCP Calls: **1**
- Tools Used: `package_run_check`
- Clients Used: Visual Studio Code

### MCP Client Usage Comparison

Packages that used MCP tools by client (a package may use multiple clients):

| Client | Packages |
|--------|----------|
| Visual Studio Code | 11 |
| github-copilot-developer | 5 |


---

## MCP Tool Usage

| Tool | Calls | Success Rate | Users | Packages |
|------|-------|--------------|-------|----------|
| ❌ `azsdk_package_run_check` | 108 | 36% | 23 | 20 |
| ❌ `azsdk_package_build_code` | 92 | 60% | 23 | 33 |
| ❌ `azsdk_package_update_changelog_content` | 67 | 34% | 11 | 17 |
| ❌ `azsdk_check_package_release_readiness` | 36 | 64% | 7 | 23 |
| ❌ `azsdk_package_update_version` | 34 | 65% | 8 | 13 |
| ⚠️ `azsdk_release_sdk` | 26 | 88% | 3 | 11 |
| ❌ `azsdk_package_run_tests` | 13 | 62% | 2 | 2 |
| ⚠️ `azsdk_package_update_metadata` | 11 | 73% | 6 | 8 |

---

*Report generated by Azure SDK MCP Adoption Skill*
