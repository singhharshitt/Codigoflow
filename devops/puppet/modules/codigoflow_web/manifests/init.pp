# @summary Web server package/service baseline (ownership: Puppet).
class codigoflow_web (
  Integer $port = 8080,
) {
  package { 'nginx':
    ensure => installed,
  }

  service { 'nginx':
    ensure  => running,
    enable  => true,
    require => Package['nginx'],
  }

  file { '/etc/nginx/sites-available/codigoflow-puppet.conf':
    ensure  => file,
    content => template('codigoflow_web/site.conf.erb'),
    notify  => Service['nginx'],
    require => Package['nginx'],
  }
}
