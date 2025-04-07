// Mock implementations for Bifrost library functions
export const encode_group_pkg = jest.fn().mockReturnValue('mocked_group_pkg');

export const decode_group_pkg = jest.fn().mockReturnValue({
  threshold: 2,
  commits: [
    { idx: 1, pubkey: 'pubkey1', hidden_pn: 'hidden1', binder_pn: 'binder1' },
    { idx: 2, pubkey: 'pubkey2', hidden_pn: 'hidden2', binder_pn: 'binder2' },
    { idx: 3, pubkey: 'pubkey3', hidden_pn: 'hidden3', binder_pn: 'binder3' }
  ],
  group_pk: 'group_pubkey'
});

export const encode_share_pkg = jest.fn().mockReturnValue('mocked_share_pkg');

export const decode_share_pkg = jest.fn().mockReturnValue({
  idx: 1,
  binder_sn: 'binder_sn',
  hidden_sn: 'hidden_sn',
  seckey: 'share_seckey'
});

export const generate_dealer_pkg = jest.fn().mockReturnValue({
  group: { 
    threshold: 2, 
    commits: [
      { idx: 1, pubkey: 'pubkey1', hidden_pn: 'hidden1', binder_pn: 'binder1' },
      { idx: 2, pubkey: 'pubkey2', hidden_pn: 'hidden2', binder_pn: 'binder2' },
      { idx: 3, pubkey: 'pubkey3', hidden_pn: 'hidden3', binder_pn: 'binder3' }
    ], 
    group_pk: 'group_pk' 
  },
  shares: [
    { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' },
    { idx: 2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' },
    { idx: 3, binder_sn: 'binder3', hidden_sn: 'hidden3', seckey: 'seckey3' }
  ]
});

export const recover_secret_key = jest.fn().mockReturnValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

export class BifrostNode {
  constructor() {
    this.on = jest.fn();
    this.emit = jest.fn();
    this.connect = jest.fn().mockResolvedValue(this);
    this.close = jest.fn().mockResolvedValue(this);
  }

  on = jest.fn();
  emit = jest.fn();
  connect = jest.fn().mockResolvedValue(this);
  close = jest.fn().mockResolvedValue(this);
}

export class BifrostSigner {
  constructor() {
    this.pubkey = 'mocked_pubkey';
    this.sign = jest.fn().mockResolvedValue('mocked_signature');
  }

  pubkey = 'mocked_pubkey';
  sign = jest.fn().mockResolvedValue('mocked_signature');
} 