# @summary OS baseline packages, users, and directories for CódigoFlow lab nodes.
class codigoflow_base (
  String $app_user = 'codigoflow',
) {
  package { ['curl', 'ca-certificates']:
    ensure => installed,
  }

  user { $app_user:
    ensure => present,
    system => true,
    shell  => '/usr/sbin/nologin',
    home   => '/nonexistent',
  }

  file { ['/opt/codigoflow', '/var/log/codigoflow']:
    ensure => directory,
    owner  => $app_user,
    group  => $app_user,
    mode   => '0755',
  }
}
