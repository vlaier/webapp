import { Grid, Typography } from '@material-ui/core'
import React, { useState } from 'react'
import DepositSelector from './DepositSelector/DepositSelector'
import RangeSelector from './RangeSelector/RangeSelector'
import useStyles from './style'
import { BN } from '@project-serum/anchor'
import { SwapToken } from '@selectors/solanaWallet'
import { printBN, printBNtoBN } from '@consts/utils'
import { PublicKey } from '@solana/web3.js'

export interface INewPosition {
  tokens: SwapToken[]
  tokensB: SwapToken[]
  data: Array<{ x: number; y: number }>
  midPriceIndex: number
  addLiquidityHandler: (
    leftTickIndex: number,
    rightTickIndex: number
  ) => void
  onChangePositionTokens: (tokenAIndex: number | null, tokenBindex: number | null, feeTierIndex: number) => void
  isCurrentPoolExisting: boolean
  calcAmount: (
    amount: BN,
    leftRangeTickIndex: number,
    rightRangeTickIndex: number,
    tokenAddress: PublicKey
  ) => BN
  feeTiers: number[]
  ticksLoading: boolean
  isTokenXFirst: boolean
}

export const INewPosition: React.FC<INewPosition> = ({
  tokens,
  tokensB,
  data,
  midPriceIndex,
  addLiquidityHandler,
  onChangePositionTokens,
  isCurrentPoolExisting,
  calcAmount,
  feeTiers,
  ticksLoading,
  isTokenXFirst
}) => {
  const classes = useStyles()

  const [leftRange, setLeftRange] = useState(0)
  const [rightRange, setRightRange] = useState(0)

  const [tokenAIndex, setTokenAIndex] = useState<number | null>(null)
  const [tokenBIndex, setTokenBIndex] = useState<number | null>(null)

  const [tokenADeposit, setTokenADeposit] = useState<string>('')
  const [tokenBDeposit, setTokenBDeposit] = useState<string>('')

  const setRangeBlockerInfo = () => {
    if (tokenAIndex === null || tokenBIndex === null) {
      return 'Select tokens to set price range.'
    }

    if (!isCurrentPoolExisting) {
      return 'Pool is not existent.'
    }

    if (ticksLoading) {
      return 'Loading data...'
    }

    if (data.length === 0) {
      return 'Cannot get necessary data. Try later.'
    }

    return ''
  }

  const noRangePlaceholderProps = {
    data: Array(100).fill(1).map((_e, index) => ({ x: index, y: index })),
    midPriceIndex: 50,
    tokenFromSymbol: 'ABC',
    tokenToSymbol: 'XYZ'
  }

  const getOtherTokenAmount = (amount: BN, left: number, right: number, byFirst: boolean) => {
    const printIndex = byFirst ? tokenAIndex : tokenBIndex
    if (printIndex === null) {
      return '0.0'
    }

    const result = calcAmount(amount, left, right, tokens[printIndex].assetAddress)

    return printBN(result, tokens[printIndex].decimal)
  }

  return (
    <Grid container className={classes.wrapper}>
      <Typography className={classes.title}>Add new liquidity position</Typography>

      <Grid container direction='row' justifyContent='space-between'>
        <DepositSelector
          tokens={tokens}
          tokensB={tokensB}
          setPositionTokens={(index1, index2, fee) => {
            setTokenAIndex(index1)
            setTokenBIndex(index2)
            onChangePositionTokens(index1, index2, fee)

            if (index1 !== null && rightRange > midPriceIndex) {
              const amount = getOtherTokenAmount(printBNtoBN(tokenADeposit, tokens[index1].decimal), leftRange, rightRange, true)

              if (index2 !== null && +tokenADeposit !== 0) {
                setTokenBDeposit(amount)

                return
              }
            }

            if (index2 !== null && leftRange < midPriceIndex) {
              const amount = getOtherTokenAmount(printBNtoBN(tokenBDeposit, tokens[index2].decimal), leftRange, rightRange, false)

              if (index1 !== null && +tokenBDeposit !== 0) {
                setTokenADeposit(amount)
              }
            }
          }}
          onAddLiquidity={
            () => {
              if (tokenAIndex !== null && tokenBIndex !== null) {
                addLiquidityHandler(
                  leftRange,
                  rightRange
                )
              }
            }
          }
          tokenAInputState={{
            value: tokenADeposit,
            setValue: (value) => {
              if (tokenAIndex === null) {
                return
              }
              setTokenADeposit(value)
              setTokenBDeposit(getOtherTokenAmount(printBNtoBN(value, tokens[tokenAIndex].decimal), leftRange, rightRange, true))
            },
            blocked: !ticksLoading && tokenAIndex !== null && tokenBIndex !== null && (isTokenXFirst ? rightRange <= midPriceIndex : rightRange < midPriceIndex),
            blockerInfo: 'Range only for single-asset deposit.'
          }}
          tokenBInputState={{
            value: tokenBDeposit,
            setValue: (value) => {
              if (tokenBIndex === null) {
                return
              }
              setTokenBDeposit(value)
              setTokenADeposit(getOtherTokenAmount(printBNtoBN(value, tokens[tokenBIndex].decimal), leftRange, rightRange, false))
            },
            blocked: !ticksLoading && tokenAIndex !== null && tokenBIndex !== null && (isTokenXFirst ? leftRange > midPriceIndex : leftRange >= midPriceIndex),
            blockerInfo: 'Range only for single-asset deposit.'
          }}
          feeTiers={feeTiers}
          isCurrentPoolExisting={isCurrentPoolExisting}
        />

        <RangeSelector
          onChangeRange={
            (left, right) => {
              setLeftRange(left)
              setRightRange(right)

              if (tokenAIndex !== null && right > midPriceIndex) {
                const amount = getOtherTokenAmount(printBNtoBN(tokenADeposit, tokens[tokenAIndex].decimal), left, right, true)

                if (tokenBIndex !== null && +tokenADeposit !== 0) {
                  setTokenBDeposit(amount)

                  return
                }
              }

              if (tokenBIndex !== null && left < midPriceIndex) {
                const amount = getOtherTokenAmount(printBNtoBN(tokenBDeposit, tokens[tokenBIndex].decimal), left, right, false)

                if (tokenAIndex !== null && +tokenBDeposit !== 0) {
                  setTokenADeposit(amount)
                }
              }
            }
          }
          blocked={tokenAIndex === null || tokenBIndex === null || !isCurrentPoolExisting || data.length === 0 || ticksLoading}
          blockerInfo={setRangeBlockerInfo()}
          {
          ...(
            tokenAIndex === null || tokenBIndex === null || !isCurrentPoolExisting || data.length === 0 || ticksLoading
              ? noRangePlaceholderProps
              : {
                data,
                midPriceIndex,
                tokenFromSymbol: tokens[tokenAIndex].symbol,
                tokenToSymbol: tokens[tokenBIndex].symbol
              }
          )
          }
        />
      </Grid>
    </Grid>
  )
}

export default INewPosition