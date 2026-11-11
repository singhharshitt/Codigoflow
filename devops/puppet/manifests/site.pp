# CódigoFlow site manifest — Puppet owns OS baseline and declared config.
# Ansible owns application release orchestration; Nagios owns monitoring.

node default {
  include codigoflow_base
  include codigoflow_web
  include codigoflow_app
}
