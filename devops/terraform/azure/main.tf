# Azure sample — format/init/validate/plan supported.
# Apply only when Azure credentials are configured and verified.
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "prefix" {
  type    = string
  default = "codigoflow"
}

resource "azurerm_resource_group" "lab" {
  name     = "${var.prefix}-lab-rg"
  location = var.location
  tags = {
    Project   = "CodigoFlow"
    ManagedBy = "Terraform"
  }
}

output "resource_group_name" {
  value = azurerm_resource_group.lab.name
}
