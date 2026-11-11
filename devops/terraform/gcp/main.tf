# GCP sample — format/init/validate/plan supported.
# Apply only when GCP credentials are configured and verified.
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

resource "google_compute_network" "lab" {
  name                    = "codigoflow-lab-vpc"
  auto_create_subnetworks = true
}

output "network_name" {
  value = google_compute_network.lab.name
}
