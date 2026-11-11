# @summary Application configuration resources owned by Puppet.
class codigoflow_app (
  String $app_root = '/opt/codigoflow/app',
) {
  file { $app_root:
    ensure => directory,
    mode   => '0755',
  }

  file { "${app_root}/puppet-managed.marker":
    ensure  => file,
    content => "ManagedBy=Puppet\nProject=CodigoFlow\n",
    mode    => '0644',
    require => File[$app_root],
  }

  include codigoflow_app::drift
}
