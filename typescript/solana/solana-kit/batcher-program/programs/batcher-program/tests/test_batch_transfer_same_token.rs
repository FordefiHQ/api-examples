use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::{InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_system_interface::instruction as system_instruction;
use solana_transaction::versioned::VersionedTransaction;
use spl_associated_token_account_interface::{
    address::get_associated_token_address,
    instruction::create_associated_token_account,
};
use spl_token_interface::{
    instruction as token_instruction,
    state::{Account as TokenAccount, Mint},
};

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    let program_id = batcher_program::id();
    let bytes = include_bytes!("../../../target/deploy/batcher_program.so");
    svm.add_program(program_id, bytes).unwrap();

    (svm, payer)
}

fn create_mint(svm: &mut LiteSVM, payer: &Keypair, authority: &Pubkey) -> Keypair {
    let mint = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(Mint::LEN);

    let ixs = vec![
        system_instruction::create_account(
            &payer.pubkey(),
            &mint.pubkey(),
            rent,
            Mint::LEN as u64,
            &spl_token_interface::ID,
        ),
        token_instruction::initialize_mint2(
            &spl_token_interface::ID,
            &mint.pubkey(),
            authority,
            None,
            6,
        )
        .unwrap(),
    ];

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer, &mint]).unwrap();
    svm.send_transaction(tx).unwrap();

    mint
}

fn create_ata(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Pubkey {
    let ix = create_associated_token_account(
        &payer.pubkey(),
        owner,
        mint,
        &spl_token_interface::ID,
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).unwrap();

    get_associated_token_address(owner, mint)
}

fn mint_tokens(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint: &Pubkey,
    dest: &Pubkey,
    amount: u64,
) {
    let ix = token_instruction::mint_to(
        &spl_token_interface::ID,
        mint,
        dest,
        &payer.pubkey(),
        &[],
        amount,
    )
    .unwrap();

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn get_token_balance(svm: &LiteSVM, token_account: &Pubkey) -> u64 {
    let account = svm.get_account(token_account).unwrap();
    TokenAccount::unpack(&account.data).unwrap().amount
}

#[test]
fn test_batch_transfer_same_token_success() {
    let (mut svm, payer) = setup();

    let mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let sender_ata = create_ata(&mut svm, &payer, &mint.pubkey(), &payer.pubkey());
    mint_tokens(&mut svm, &payer, &mint.pubkey(), &sender_ata, 1_000_000);

    let receiver1 = Keypair::new();
    let receiver2 = Keypair::new();
    let receiver3 = Keypair::new();
    let recv_ata1 = create_ata(&mut svm, &payer, &mint.pubkey(), &receiver1.pubkey());
    let recv_ata2 = create_ata(&mut svm, &payer, &mint.pubkey(), &receiver2.pubkey());
    let recv_ata3 = create_ata(&mut svm, &payer, &mint.pubkey(), &receiver3.pubkey());

    let amounts: Vec<u64> = vec![100_000, 200_000, 300_000];

    let mut account_metas = batcher_program::accounts::BatchTransferSameToken {
        sender: payer.pubkey(),
        sender_token_account: sender_ata,
        token_program: spl_token_interface::ID,
    }
    .to_account_metas(None);

    account_metas.push(AccountMeta::new(recv_ata1, false));
    account_metas.push(AccountMeta::new(recv_ata2, false));
    account_metas.push(AccountMeta::new(recv_ata3, false));

    let ix = Instruction::new_with_bytes(
        batcher_program::id(),
        &batcher_program::instruction::BatchTransferSameToken { amounts }.data(),
        account_metas,
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&payer]).unwrap();
    svm.send_transaction(tx).unwrap();

    assert_eq!(get_token_balance(&svm, &sender_ata), 400_000);
    assert_eq!(get_token_balance(&svm, &recv_ata1), 100_000);
    assert_eq!(get_token_balance(&svm, &recv_ata2), 200_000);
    assert_eq!(get_token_balance(&svm, &recv_ata3), 300_000);
}

#[test]
fn test_batch_transfer_same_token_single() {
    let (mut svm, payer) = setup();

    let mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let sender_ata = create_ata(&mut svm, &payer, &mint.pubkey(), &payer.pubkey());
    mint_tokens(&mut svm, &payer, &mint.pubkey(), &sender_ata, 500_000);

    let receiver = Keypair::new();
    let recv_ata = create_ata(&mut svm, &payer, &mint.pubkey(), &receiver.pubkey());

    let amounts: Vec<u64> = vec![500_000];

    let mut account_metas = batcher_program::accounts::BatchTransferSameToken {
        sender: payer.pubkey(),
        sender_token_account: sender_ata,
        token_program: spl_token_interface::ID,
    }
    .to_account_metas(None);
    account_metas.push(AccountMeta::new(recv_ata, false));

    let ix = Instruction::new_with_bytes(
        batcher_program::id(),
        &batcher_program::instruction::BatchTransferSameToken { amounts }.data(),
        account_metas,
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&payer]).unwrap();
    svm.send_transaction(tx).unwrap();

    assert_eq!(get_token_balance(&svm, &sender_ata), 0);
    assert_eq!(get_token_balance(&svm, &recv_ata), 500_000);
}
