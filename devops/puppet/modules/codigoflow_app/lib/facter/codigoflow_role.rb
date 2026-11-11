# frozen_string_literal: true

Facter.add(:codigoflow_role) do
  setcode do
    if File.exist?('/opt/codigoflow/app/puppet-managed.marker')
      'application'
    else
      'unknown'
    end
  end
end
