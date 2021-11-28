import { colors, newTypography } from '@static/theme'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles(() => ({
  general: {
    borderRadius: 10,
    textAlign: 'center',
    textTransform: 'none',
    ...newTypography.body1,
    backgroundColor: colors.invariant.accent1,
    transition: 'all 500ms ease',
    padding: '10px 19px',
    '&:hover': {
      backgroundColor: colors.invariant.accent2
    }
  },
  disabled: {
    background: `${colors.invariant.componentOut3} !important`,
    color: `${colors.white.main} !important`
  }
}))

export default useStyles