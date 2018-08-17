require 'rails_helper'

RSpec.describe NimbusRemoteAuthenticatable::NimbusAuthenticatable do

  let(:user) { build(:user, email: 'test@maestrano.com', password: 'superpassword') }
  let(:auth_hash) {{ "user" => { "email" => user.email, "password" => user.password }}}

  let(:subject) { described_class.new(Rack::MockRequest.env_for('/mnoe/auth/users/sign_in', {params: auth_hash}), :user) }

  # Stub MnoHub call
  before {stub_api_v2(:get, '/users', user, [], {filter: {email: 'test@maestrano.com'}, page: {number: 1, size: 1}})}

  # Nimbus stub
  let(:remote_auth_url) { 'https://nimbus.example.com/auth' }

  before do
    allow(ENV).to receive(:fetch).with('REMOTE_AUTH_URL').and_return(remote_auth_url)
  end


  def nimbus_stub(success = true)
    auth_params = {username: user.email, password: user.password}

    response = if success
                 {
                   body: '{"userDetails":{"email":"test@maestrano.com"}',
                   headers: {'Content-Type' => 'application/json'}
                 }
               else
                 {
                   body: '{"info":"Invalid credentials. Please try again.","status":401}',
                   headers: {'Content-Type' => 'application/json'},
                   status: 401
                 }
               end

    stub_request(:post, remote_auth_url)
      .with(body: auth_params.to_json).to_return(response)
  end

  describe "#valid?" do
    context 'when user is authenticated against Nimbus' do
      before { nimbus_stub }

      it { is_expected.to be_valid }
    end

    context 'when user is not authenticated against Nimbus' do
      before { nimbus_stub(false) }

      it { is_expected.not_to be_valid }
    end
  end

  describe "#authenticate!" do
    context 'when user is authenticated against Nimbus' do
      before { nimbus_stub }

      context 'when the user exists in MnoHub' do
        it "authenticates user" do
          expect(subject.authenticate!).to eq(:success)
        end
      end

      context 'when the user does not exist in MnoHub' do
        before {stub_api_v2(:get, '/users', [], [], {filter: {email: 'test@maestrano.com'}, page: {number: 1, size: 1}})}
        it "fails to authenticate user" do
          expect(subject.authenticate!).to eq(:failure)
        end
      end
    end

    context 'when user is not authenticated against Nimbus' do
      before { nimbus_stub(false) }
      before {allow_any_instance_of(MnoEnterprise::User).to receive(:lock_strategy_enabled?).and_return(false)}

      it "fails to authenticate user" do
        expect(subject.authenticate!).to eq(:failure)
      end
    end
  end
end
