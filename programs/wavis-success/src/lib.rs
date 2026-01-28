use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("GjWUevQsr5QLWxRzXNpVCZKkQmjEdjijEA65JujZ2HXS");

/// 手数料額（0.5 USDC相当、USDC decimals=6を想定）
pub const FEE_AMOUNT: u64 = 500_000;

/// Anchorのアカウントディスクリミネーターサイズ
pub const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod wavis_success {
    use super::*;

    /// グローバルStateアカウントを初期化
    /// 管理者としてsignerを設定し、金庫とシェアを0で初期化
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let clock = Clock::get()?;
        
        state.admin = ctx.accounts.admin.key();
        state.total_deposited = 0;
        state.total_shares = 0;
        state.blacklist = Vec::new();
        state.last_update_time = clock.unix_timestamp;
        
        msg!("WAVIS State initialized with admin: {}", state.admin);
        msg!("Initial timestamp: {}", clock.unix_timestamp);
        
        Ok(())
    }

    /// ブラックリストの更新（管理者専用）
    /// アドレスを追加または削除する
    pub fn admin_update_blacklist(
        ctx: Context<AdminUpdateBlacklist>,
        address: Pubkey,
        add: bool,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        if add {
            // アドレスを追加（重複チェック）
            if !state.blacklist.contains(&address) {
                state.blacklist.push(address);
                msg!("Added {} to blacklist", address);
            }
        } else {
            // アドレスを削除
            state.blacklist.retain(|&x| x != address);
            msg!("Removed {} from blacklist", address);
        }
        
        Ok(())
    }

    /// USDCを入金してシェアを取得
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let user_vault = &mut ctx.accounts.user_vault;
        
        // Shadow Yield: 経過時間に基づいてtotal_depositedを増やす
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let elapsed_seconds = now.saturating_sub(state.last_update_time);
        
        if state.total_deposited > 0 {
            let seconds = elapsed_seconds as u128;
            let old_total = state.total_deposited as u128;
            
            msg!("DEBUG: Applying Shadow Yield...");
            msg!("  Seconds elapsed: {}", seconds);
            msg!("  Old total deposited: {}", old_total);
            msg!("  Last update time: {}", state.last_update_time);
            msg!("  Current time: {}", now);
            
            // 1秒につき0.01% (1ベーシスポイント)
            // earned = (total_deposited * seconds * 1) / 10000
            let yield_earned = if seconds > 0 {
                old_total
                    .checked_mul(seconds)
                    .unwrap()
                    .checked_mul(1)
                    .unwrap()
                    .checked_div(10000)
                    .unwrap()
            } else {
                0
            };
            
            msg!("  Calculated yield: {}", yield_earned);
            
            // デモ用：最低保証ボーナス（1秒以上経過してたら最低1000 = 0.001 USDC）
            let final_yield = if seconds > 0 {
                if yield_earned > 0 {
                    yield_earned
                } else {
                    1000 // 最低保証
                }
            } else {
                0
            };
            
            if final_yield > 0 {
                let final_yield_u64 = final_yield as u64;
                state.total_deposited = state.total_deposited.checked_add(final_yield_u64).unwrap();
                state.last_update_time = now;
                msg!("✨ Shadow Yield applied: +{} USDC ({} seconds elapsed)", final_yield_u64, seconds);
            }
        }
        
        // Ingress Filtering: ブラックリストチェック
        require!(
            !state.blacklist.contains(&ctx.accounts.user.key()),
            ErrorCode::Blacklisted
        );
        
        // 初回入金ならbumpを保存
        if user_vault.shares == 0 && user_vault.bump == 0 {
            user_vault.bump = ctx.bumps.user_vault;
        }
        
        // シェア計算
        let shares_to_mint = if state.total_shares == 0 {
            // 初回入金: shares = amount
            amount as u128
        } else {
            // 2回目以降: shares = (amount * total_shares) / total_deposited
            ((amount as u128) * state.total_shares) / (state.total_deposited as u128)
        };
        
        // CPIでユーザーからVaultへUSDCを転送
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        
        // State更新
        state.total_deposited = state.total_deposited.checked_add(amount).unwrap();
        state.total_shares = state.total_shares.checked_add(shares_to_mint).unwrap();
        
        // UserVault更新
        user_vault.shares = user_vault.shares.checked_add(shares_to_mint).unwrap();
        
        msg!(
            "Deposited {} USDC, minted {} shares. Total deposited: {}, Total shares: {}",
            amount,
            shares_to_mint,
            state.total_deposited,
            state.total_shares
        );
        
        Ok(())
    }

    /// USDCを出金（手数料を差し引く）
    pub fn withdraw(ctx: Context<Withdraw>, shares: u128) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let user_vault = &mut ctx.accounts.user_vault;
        
        // Shadow Yield: 経過時間に基づいてtotal_depositedを増やす
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let elapsed_seconds = now.saturating_sub(state.last_update_time);
        
        if state.total_deposited > 0 {
            let seconds = elapsed_seconds as u128;
            let old_total = state.total_deposited as u128;
            
            msg!("DEBUG: Applying Shadow Yield...");
            msg!("  Seconds elapsed: {}", seconds);
            msg!("  Old total deposited: {}", old_total);
            msg!("  Last update time: {}", state.last_update_time);
            msg!("  Current time: {}", now);
            
            // 1秒につき0.01% (1ベーシスポイント)
            // earned = (total_deposited * seconds * 1) / 10000
            let yield_earned = if seconds > 0 {
                old_total
                    .checked_mul(seconds)
                    .unwrap()
                    .checked_mul(1)
                    .unwrap()
                    .checked_div(10000)
                    .unwrap()
            } else {
                0
            };
            
            msg!("  Calculated yield: {}", yield_earned);
            
            // デモ用：最低保証ボーナス（1秒以上経過してたら最低1000 = 0.001 USDC）
            let final_yield = if seconds > 0 {
                if yield_earned > 0 {
                    yield_earned
                } else {
                    1000 // 最低保証
                }
            } else {
                0
            };
            
            if final_yield > 0 {
                let final_yield_u64 = final_yield as u64;
                state.total_deposited = state.total_deposited.checked_add(final_yield_u64).unwrap();
                state.last_update_time = now;
                msg!("✨ Shadow Yield applied: +{} USDC ({} seconds elapsed)", final_yield_u64, seconds);
            }
        }
        
        // ユーザーが十分なシェアを持っているか確認
        require!(user_vault.shares >= shares, ErrorCode::InsufficientFunds);
        
        // 払い出し額計算: amount = (shares * total_deposited) / total_shares
        let amount_before_fee = ((shares * (state.total_deposited as u128)) / state.total_shares) as u64;
        
        // 手数料を差し引く
        require!(amount_before_fee >= FEE_AMOUNT, ErrorCode::InsufficientFunds);
        let amount_after_fee = amount_before_fee.checked_sub(FEE_AMOUNT).unwrap();
        
        // PDA署名を使ってVaultからユーザーへ転送
        // VaultのトークンアカウントのauthorityがStateのPDAであると仮定
        let bump = ctx.bumps.state;
        let seeds = &[b"state".as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, amount_after_fee)?;
        
        // State更新
        state.total_deposited = state.total_deposited.checked_sub(amount_before_fee).unwrap();
        state.total_shares = state.total_shares.checked_sub(shares).unwrap();
        
        // UserVault更新
        user_vault.shares = user_vault.shares.checked_sub(shares).unwrap();
        
        msg!(
            "Withdrew {} shares, received {} USDC (fee: {}). Total deposited: {}, Total shares: {}",
            shares,
            amount_after_fee,
            FEE_AMOUNT,
            state.total_deposited,
            state.total_shares
        );
        
        Ok(())
    }
}

/// Initialize命令のContext
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// 管理者アカウント（署名者、支払者）
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// グローバルStateアカウント（PDA）
    /// seeds: ["state"]
    /// space計算:
    ///   - discriminator: 8
    ///   - admin (Pubkey): 32
    ///   - total_deposited (u64): 8
    ///   - total_shares (u128): 16
    ///   - blacklist (Vec<Pubkey>): 4 (vec length) + 0 (初期は空)
    ///   - last_update_time (i64): 8
    ///   合計: 8 + 32 + 8 + 16 + 4 + 8 = 76バイト
    ///   余裕を持たせて256バイト確保（ブラックリスト拡張用）
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8 + 16 + 4 + 8 + 256,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,
    
    /// システムプログラム
    pub system_program: Program<'info, System>,
}

/// ブラックリスト更新のContext
#[derive(Accounts)]
pub struct AdminUpdateBlacklist<'info> {
    /// 管理者アカウント（署名者）
    #[account(
        mut,
        constraint = admin.key() == state.admin @ ErrorCode::Unauthorized
    )]
    pub admin: Signer<'info>,
    
    /// グローバルStateアカウント
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,
}

/// 入金のContext
#[derive(Accounts)]
pub struct Deposit<'info> {
    /// 入金するユーザー（署名者）
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// ユーザーのUSDCトークンアカウント
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// グローバルStateアカウント
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,
    
    /// ユーザーVaultアカウント（PDA、初回なら自動作成）
    /// seeds: ["user_vault", user.key()]
    /// space計算:
    ///   - discriminator: 8
    ///   - shares (u128): 16
    ///   - bump (u8): 1
    ///   合計: 25バイト
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 16 + 1,
        seeds = [b"user_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,
    
    /// VaultのUSDCトークンアカウント（PDA）
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// トークンプログラム
    pub token_program: Program<'info, Token>,
    
    /// システムプログラム
    pub system_program: Program<'info, System>,
}

/// 出金のContext
#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// 出金するユーザー（署名者）
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// ユーザーのUSDCトークンアカウント
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// グローバルStateアカウント
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,
    
    /// ユーザーVaultアカウント（PDA）
    #[account(
        mut,
        seeds = [b"user_vault", user.key().as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,
    
    /// VaultのUSDCトークンアカウント（PDA）
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// トークンプログラム
    pub token_program: Program<'info, Token>,
}

/// グローバル設定を保持するStateアカウント
#[account]
pub struct State {
    /// 管理者の公開鍵
    pub admin: Pubkey,
    
    /// 金庫内のUSDC総量（USDC decimals=6を想定）
    pub total_deposited: u64,
    
    /// 発行済みの総シェア数（u128で高精度計算）
    pub total_shares: u128,
    
    /// 入金拒否リスト
    pub blacklist: Vec<Pubkey>,
    
    /// 最後の更新時刻（Shadow Yield計算用）
    pub last_update_time: i64,
}

/// ユーザーごとのVaultアカウント
#[account]
pub struct UserVault {
    /// ユーザーが保有するシェア数
    /// シェアは金額ではなく、プール内の持分比率を表す
    pub shares: u128,
    
    /// PDAのbump seed
    pub bump: u8,
}

/// カスタムエラーコード
#[error_code]
pub enum ErrorCode {
    #[msg("This address is blocked.")]
    Blacklisted,
    
    #[msg("Insufficient funds.")]
    InsufficientFunds,
    
    #[msg("Unauthorized access.")]
    Unauthorized,
}
