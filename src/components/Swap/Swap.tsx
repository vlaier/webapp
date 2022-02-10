import React, { useEffect, useRef } from 'react'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@project-serum/anchor'
import {
  printBN,
  printBNtoBN,
  handleSimulate,
  findPairIndex,
  findPairs,
  calcCurrentPriceOfPool
} from '@consts/utils'
import { Decimal } from '@invariant-labs/sdk/lib/market'
import { blurContent, unblurContent } from '@consts/uiUtils'
import { Grid, Typography, Box, CardMedia, Button } from '@material-ui/core'
import Slippage from '@components/Swap/slippage/Slippage'
import ExchangeAmountInput from '@components/Inputs/ExchangeAmountInput/ExchangeAmountInput'
import TransactionDetails from '@components/Swap/transactionDetails/TransactionDetails'
import { WRAPPED_SOL_ADDRESS } from '@consts/static'
import { Swap as SwapData } from '@reducers/swap'
import { Status } from '@reducers/solanaWallet'
import SwapArrows from '@static/svg/swap-arrows.svg'
import infoIcon from '@static/svg/info.svg'
import settingIcon from '@static/svg/settings.svg'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import AnimatedButton, { ProgressState } from '@components/AnimatedButton/AnimatedButton'
import useStyles from './style'
import { Tick } from '@invariant-labs/sdk/src/market'
import { PoolWithAddress } from '@reducers/pools'
import ExchangeRate from './ExchangeRate/ExchangeRate'
export interface SwapToken {
  balance: BN
  decimals: number
  symbol: string
  assetAddress: PublicKey
  name: string
  logoURI: string
  address: PublicKey
}

export interface Pools {
  tokenX: PublicKey
  tokenY: PublicKey
  tokenXReserve: PublicKey
  tokenYReserve: PublicKey
  tickSpacing: number
  sqrtPrice: {
    v: BN
    scale: number
  }
  fee: {
    val: BN
    scale: number
  }
  exchangeRate: {
    val: BN
    scale: number
  }
}

export interface ISwap {
  walletStatus: Status
  swapData: SwapData
  tokens: SwapToken[]
  pools: PoolWithAddress[]
  onSwap: (
    slippage: Decimal,
    knownPrice: Decimal,
    tokenFrom: PublicKey,
    tokenTo: PublicKey,
    poolIndex: number,
    amount: BN,
    byAmountIn: boolean
  ) => void
  onSetPair: (tokenFrom: PublicKey, tokenTo: PublicKey) => void
  progress: ProgressState
  poolInit: boolean
  poolTicks: { [x: string]: Tick[] }
  fullSolBalance: BN
}
export const Swap: React.FC<ISwap> = ({
  walletStatus,
  tokens,
  pools,
  onSwap,
  onSetPair,
  progress,
  poolInit,
  poolTicks,
  fullSolBalance
}) => {
  const classes = useStyles()
  enum inputTarget {
    FROM = 'from',
    TO = 'to'
  }
  const [tokenFromIndex, setTokenFromIndex] = React.useState<number | null>(
    tokens.length ? 0 : null
  )

  const [tokenToIndex, setTokenToIndex] = React.useState<number | null>(null)
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)
  const [amountFrom, setAmountFrom] = React.useState<string>('')
  const [amountTo, setAmountTo] = React.useState<string>('')
  const [swap, setSwap] = React.useState<boolean | null>(null)
  const [tokensY, setTokensY] = React.useState<SwapToken[]>(tokens)
  const [rotates, setRotates] = React.useState<number>(0)
  const [poolIndex, setPoolIndex] = React.useState<number | null>(null)
  const [slippTolerance, setSlippTolerance] = React.useState<string>('1')
  const [throttle, setThrottle] = React.useState<boolean>(false)
  const [settings, setSettings] = React.useState<boolean>(false)
  const [detailsOpen, setDetailsOpen] = React.useState<boolean>(false)
  const [inputRef, setInputRef] = React.useState<string>(inputTarget.FROM)
  const [simulateResult, setSimulateResult] = React.useState<{
    amountOut: BN
    simulateSuccess: boolean
    poolIndex: number
    AmountOutWithFee: BN
  }>({ amountOut: new BN(0), simulateSuccess: true, poolIndex: 0, AmountOutWithFee: new BN(0) })

  const timeoutRef = useRef<number>(0)

  useEffect(() => {
    if (tokenFromIndex !== null && tokenToIndex !== null) {
      onSetPair(tokens[tokenFromIndex].address, tokens[tokenToIndex].address)
    }
  }, [tokenFromIndex, tokenToIndex])
  useEffect(() => {
    if (getStateMessage() === 'No route found') {
      setAmountTo('')
      setAmountFrom('')
    }
    if (inputRef === inputTarget.FROM) {
      simulateWithTimeout()
    }
  }, [amountFrom, tokenToIndex, tokenFromIndex, slippTolerance, Object.keys(poolTicks).length])

  useEffect(() => {
    if (inputRef === inputTarget.TO) {
      simulateWithTimeout()
    }
  }, [amountTo, tokenToIndex, tokenFromIndex, slippTolerance, Object.keys(poolTicks).length])

  const simulateWithTimeout = () => {
    inputRef === inputTarget.FROM ? setAmountTo('') : setAmountFrom('')
    setThrottle(true)

    clearTimeout(timeoutRef.current)
    const timeout = setTimeout(() => {
      setSimulateAmount().finally(() => {
        setThrottle(false)
      })
    }, 500)
    timeoutRef.current = timeout
  }

  useEffect(() => {
    if (tokenFromIndex !== null && tokenToIndex !== null) {
      inputRef === inputTarget.FROM
        ? setAmountTo(getKnownPrice(tokens[tokenFromIndex], tokens[tokenToIndex]).amountOut)
        : setAmountFrom(getKnownPrice(tokens[tokenToIndex], tokens[tokenFromIndex]).amountOut)
    }
  }, [simulateResult])

  useEffect(() => {
    updateEstimatedAmount()

    if (tokenToIndex !== null && tokenFromIndex !== null) {
      const pairIndex = pools.findIndex(pool => {
        return (
          (tokens[tokenFromIndex].assetAddress.equals(pool.tokenX) &&
            tokens[tokenToIndex].assetAddress.equals(pool.tokenY)) ||
          (tokens[tokenToIndex].assetAddress.equals(pool.tokenX) &&
            tokens[tokenFromIndex].assetAddress.equals(pool.tokenY))
        )
      })
      setPoolIndex(pairIndex)
    }
    if (tokenFromIndex !== null) {
      const tokensY = tokens.filter(token => {
        return findPairIndex(token.assetAddress, tokens[tokenFromIndex].assetAddress, pools) !== -1
      })
      setTokensY(tokensY)
    }
  }, [tokenToIndex, tokenFromIndex, pools.length])

  useEffect(() => {
    const temp: string = amountFrom
    setAmountFrom(amountTo)
    setAmountTo(temp)
    setInputRef(inputRef === inputTarget.FROM ? inputTarget.TO : inputTarget.FROM)
  }, [swap])

  const getKnownPrice = (assetIn: SwapToken, assetFor: SwapToken) => {
    let swapRate: number = 0
    let amountOut: number = 0
    if (poolIndex !== -1 && poolIndex !== null) {
      if (inputRef === inputTarget.FROM) {
        swapRate = +printBN(simulateResult.AmountOutWithFee, assetFor.decimals) / Number(amountFrom)
      } else {
        swapRate = Number(amountTo) / +printBN(simulateResult.AmountOutWithFee, assetIn.decimals)
      }

      amountOut = Number(printBN(simulateResult.amountOut, assetFor.decimals))
    }
    return {
      amountOut: amountOut.toFixed(assetFor.decimals),
      swapRate: swapRate
    }
  }

  const setSimulateAmount = async () => {
    if (tokenFromIndex !== null && tokenToIndex !== null) {
      const pair = findPairs(tokens[tokenFromIndex].address, tokens[tokenToIndex].address, pools)[0]
      const indexPool = Object.keys(poolTicks).filter(key => {
        return key === pair.address.toString()
      })
      if (indexPool.length === 0) {
        setAmountTo('')
        return
      }
      if (inputRef === inputTarget.FROM) {
        setSimulateResult(
          await handleSimulate(
            pools,
            poolTicks,
            {
              v: fromFee(new BN(Number(+slippTolerance * 1000)))
            },
            tokens[tokenFromIndex].address,
            tokens[tokenToIndex].address,
            printBNtoBN(amountFrom, tokens[tokenFromIndex].decimals),
            true,
            tokens[tokenFromIndex].decimals,
            tokens[tokenToIndex].decimals
          )
        )
      } else if (inputRef === inputTarget.TO) {
        setSimulateResult(
          await handleSimulate(
            pools,
            poolTicks,
            {
              v: fromFee(new BN(Number(+slippTolerance * 1000)))
            },
            tokens[tokenFromIndex].address,
            tokens[tokenToIndex].address,
            printBNtoBN(amountTo, tokens[tokenToIndex].decimals),
            false,
            tokens[tokenFromIndex].decimals,
            tokens[tokenToIndex].decimals
          )
        )
      }
    }
  }

  const getIsXToY = (fromToken: PublicKey, toToken: PublicKey) => {
    const swapPool = pools.find(
      pool =>
        (fromToken.equals(pool.tokenX) && toToken.equals(pool.tokenY)) ||
        (fromToken.equals(pool.tokenY) && toToken.equals(pool.tokenX))
    )
    return !!swapPool
  }
  const updateEstimatedAmount = () => {
    if (tokenFromIndex !== null && tokenToIndex !== null) {
      setAmountTo(getKnownPrice(tokens[tokenFromIndex], tokens[tokenToIndex]).amountOut)
    }
  }

  const getStateMessage = () => {
    if (walletStatus !== Status.Initialized) {
      return 'Please connect wallet'
    }
    if (tokenFromIndex === null || tokenToIndex === null) {
      return 'Choose pair'
    }
    if (!poolInit || throttle) {
      return 'Loading'
    }
    if (!getIsXToY(tokens[tokenFromIndex].assetAddress, tokens[tokenToIndex].assetAddress)) {
      return 'No route found'
    }
    if (
      printBNtoBN(amountFrom, tokens[tokenFromIndex].decimals).gt(
        printBNtoBN(
          printBN(tokens[tokenFromIndex].balance, tokens[tokenFromIndex].decimals),
          tokens[tokenFromIndex].decimals
        )
      )
    ) {
      return 'Insufficient balance'
    }
    if (!simulateResult.simulateSuccess) {
      return 'Exceed single swap limit (split transaction into several)'
    }

    if (printBNtoBN(amountFrom, tokens[tokenFromIndex].decimals).eqn(0)) {
      return 'Insufficient volume'
    }

    return 'Swap'
  }
  const activeSwapDetails = () => {
    return (
      getStateMessage() !== 'Insufficient volume' &&
      getStateMessage() !== 'Exceed single swap limit (split transaction into several)' &&
      getStateMessage() !== 'No route found' &&
      getStateMessage() !== 'Insufficient balance'
    )
  }
  const setSlippage = (slippage: string): void => {
    setSlippTolerance(slippage)
  }

  const handleClickSettings = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
    blurContent()
    setSettings(true)
  }

  const hoverDetails = () => {
    setDetailsOpen(!detailsOpen)
  }

  const handleCloseSettings = () => {
    unblurContent()
    setSettings(false)
  }
  return (
    <Grid container className={classes.swapWrapper}>
      <Grid container className={classes.header}>
        <Typography component='h1'>Swap tokens</Typography>
        <Button onClick={handleClickSettings} className={classes.settingsIconBtn}>
          <img src={settingIcon} className={classes.settingsIcon} />
        </Button>
        <Grid className={classes.slippage}>
          <Slippage
            open={settings}
            setSlippage={setSlippage}
            handleClose={handleCloseSettings}
            anchorEl={anchorEl}
            defaultSlippage={'1'}
          />
        </Grid>
      </Grid>
      <Grid container className={classes.root} direction='column'>
        <Box className={classes.tokenComponentTextContainer}>
          <Typography className={classes.tokenComponentText}>From: </Typography>
          <Typography className={classes.tokenComponentText}>
            Balance:{' '}
            {tokenFromIndex !== null
              ? printBN(
                  tokens[tokenFromIndex].assetAddress.equals(new PublicKey(WRAPPED_SOL_ADDRESS))
                    ? fullSolBalance
                    : tokens[tokenFromIndex].balance,
                  tokens[tokenFromIndex].decimals
                )
              : '0'}
          </Typography>
        </Box>
        <ExchangeAmountInput
          value={amountFrom}
          key={swap?.toString()}
          decimal={tokenFromIndex !== null ? tokens[tokenFromIndex].decimals : 6}
          className={
            swap !== null
              ? `${classes.amountInput} ${classes.amountInputDown}`
              : `${classes.amountInput}`
          }
          setValue={value => {
            if (value.match(/^\d*\.?\d*$/)) {
              setAmountFrom(value)
              setInputRef(inputTarget.FROM)
            }
          }}
          placeholder={'0.0'}
          onMaxClick={() => {
            if (tokenToIndex !== null && tokenFromIndex !== null) {
              setAmountFrom(
                printBN(tokens[tokenFromIndex].balance, tokens[tokenFromIndex].decimals)
              )
              setInputRef(inputTarget.FROM)
            }
          }}
          tokens={tokens}
          current={tokenFromIndex !== null ? tokens[tokenFromIndex] : null}
          onSelect={(name: string) => {
            setTokenFromIndex(
              tokens.findIndex(token => {
                return name === token.symbol
              })
            )
          }}
          disabled={tokenFromIndex === null}
        />
        <Box className={classes.tokenComponentTextContainer}>
          <Box
            className={classes.swapArrowBox}
            onClick={() => {
              setRotates(rotates + 1)
              swap !== null ? setSwap(!swap) : setSwap(true)
              const tmp = tokenFromIndex
              const tokensTmp = tokens
              setTokenFromIndex(tokenToIndex)
              setTokenToIndex(tmp)
              tokens = tokensY
              setTokensY(tokensTmp)
            }}>
            <img
              src={SwapArrows}
              style={{
                transform: `rotate(${-rotates * 180}deg)`
              }}
              className={classes.swapArrows}
            />
          </Box>
          <Typography className={classes.tokenComponentText}>To (Estd.)</Typography>
          <Typography className={classes.tokenComponentText}>
            Balance:{' '}
            {tokenToIndex !== null
              ? printBN(
                  tokens[tokenToIndex].assetAddress.equals(new PublicKey(WRAPPED_SOL_ADDRESS))
                    ? fullSolBalance
                    : tokens[tokenToIndex].balance,
                  tokens[tokenToIndex].decimals
                )
              : '0'}
          </Typography>
        </Box>
        <ExchangeAmountInput
          value={amountTo}
          key={tokenToIndex?.toString()}
          className={
            swap !== null
              ? `${classes.amountInput} ${classes.amountInputUp}`
              : `${classes.amountInput}`
          }
          decimal={tokenToIndex !== null ? tokens[tokenToIndex].decimals : 6}
          setValue={value => {
            if (value.match(/^\d*\.?\d*$/)) {
              setAmountTo(value)
              setInputRef(inputTarget.TO)
            }
          }}
          placeholder={'0.0'}
          onMaxClick={() => {
            if (tokenToIndex !== null && tokenFromIndex !== null) {
              setAmountFrom(
                printBN(tokens[tokenFromIndex].balance, tokens[tokenFromIndex].decimals)
              )
            }
          }}
          tokens={tokensY}
          current={tokenToIndex !== null ? tokens[tokenToIndex] : null}
          onSelect={(name: string) => {
            setTokenToIndex(
              tokens.findIndex(token => {
                return name === token.symbol
              })
            )
            setSwap(null)
          }}
          disabled={tokenFromIndex === null}
        />
        <Box className={classes.transactionDetails}>
          <Grid
            className={classes.transactionDetailsWrapper}
            onMouseEnter={hoverDetails}
            onMouseLeave={hoverDetails}>
            <Typography className={classes.transactionDetailsHeader}>
              See transaction details
            </Typography>
            <CardMedia image={infoIcon} style={{ width: 10, height: 10, marginLeft: 4 }} />
          </Grid>
          {tokenFromIndex !== null && tokenToIndex !== null ? (
            <TransactionDetails
              open={detailsOpen && activeSwapDetails() && getStateMessage() !== 'Loading'}
              fee={{
                v: pools[simulateResult.poolIndex].fee.v
              }}
              exchangeRate={{
                val: getKnownPrice(tokens[tokenFromIndex], tokens[tokenToIndex]).swapRate,
                symbol: tokens[tokenToIndex].symbol
              }}
              decimal={tokens[tokenToIndex].decimals}
            />
          ) : null}
          {tokenFromIndex !== null && tokenToIndex !== null && activeSwapDetails() ? (
            <ExchangeRate
              tokenFromSymbol={tokens[tokenFromIndex].symbol}
              tokenToSymbol={tokens[tokenToIndex].symbol}
              amount={getKnownPrice(tokens[tokenFromIndex], tokens[tokenToIndex]).swapRate}
              tokenToDecimals={tokens[tokenToIndex].decimals}
              loading={getStateMessage() === 'Loading'}></ExchangeRate>
          ) : null}
        </Box>
        <AnimatedButton
          content={getStateMessage()}
          className={classes.swapButton}
          disabled={getStateMessage() !== 'Swap' || progress !== 'none'}
          onClick={() => {
            if (tokenFromIndex === null || tokenToIndex === null) return

            const isXtoY = getIsXToY(
              tokens[tokenFromIndex].assetAddress,
              tokens[tokenToIndex].assetAddress
            )

            onSwap(
              { v: fromFee(new BN(Number(+slippTolerance * 1000))) },
              {
                v: calcCurrentPriceOfPool(
                  pools[simulateResult.poolIndex],
                  isXtoY ? tokens[tokenFromIndex].decimals : tokens[tokenToIndex].decimals,
                  isXtoY ? tokens[tokenToIndex].decimals : tokens[tokenFromIndex].decimals
                )
              },
              tokens[tokenFromIndex].address,
              tokens[tokenToIndex].address,
              simulateResult.poolIndex,
              inputRef === inputTarget.FROM
                ? printBNtoBN(amountFrom, tokens[tokenFromIndex].decimals)
                : printBNtoBN(amountTo, tokens[tokenToIndex].decimals),
              inputRef === inputTarget.FROM
            )
          }}
          progress={progress}
        />
      </Grid>
    </Grid>
  )
}

export default Swap
