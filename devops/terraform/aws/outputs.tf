output "instance_id" {
  value = aws_instance.app.id
}

output "private_ip" {
  value = aws_instance.app.private_ip
}

output "public_ip" {
  value = aws_instance.app.public_ip
}

output "ansible_inventory_host" {
  description = "Suggested Ansible inventory host line"
  value       = aws_instance.app.public_ip != "" ? aws_instance.app.public_ip : aws_instance.app.private_ip
}

output "security_group_id" {
  value = aws_security_group.codigoflow_lab.id
}
