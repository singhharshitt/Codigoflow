# Drift correction experiment — isolated lab file only.
class codigoflow_app::drift (
  String $path = '/opt/codigoflow/lab/managed.conf',
  String $content = "desired_state=enforced\nproject=CodigoFlow\n",
) {
  file { '/opt/codigoflow/lab':
    ensure => directory,
    mode   => '0755',
  }

  file { $path:
    ensure  => file,
    content => $content,
    mode    => '0644',
    require => File['/opt/codigoflow/lab'],
  }
}
