variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "CodigoFlow"
}

variable "environment" {
  type    = string
  default = "DevOpsLab"
}

variable "ami_id" {
  type        = string
  description = "Ubuntu AMI ID for the lab instance"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "key_name" {
  type        = string
  description = "Existing EC2 key pair name"
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "ssh_ingress_cidr" {
  type        = string
  description = "CIDR allowed for SSH (never 0.0.0.0/0 by default)"
  default     = "127.0.0.1/32"
}

variable "enable_http" {
  type    = bool
  default = true
}

variable "enable_https" {
  type    = bool
  default = false
}
