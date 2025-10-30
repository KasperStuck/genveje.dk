import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: 'Søg efter butik...',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with placeholder', () => {
    render(<SearchBar {...defaultProps} />);

    expect(screen.getByPlaceholderText('Søg efter butik...')).toBeInTheDocument();
  });

  it('should display initial value', () => {
    render(<SearchBar {...defaultProps} value="test" />);

    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });

  it('should call onChange after debounce delay', async () => {
    const onChange = vi.fn();

    render(<SearchBar {...defaultProps} onChange={onChange} debounceMs={100} />);

    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.type(input, 't');

    // Should not be called immediately
    expect(onChange).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith('t');
      },
      { timeout: 500 }
    );
  });

  it('should show clear button when input has value', async () => {
    const user = userEvent.setup();

    render(<SearchBar {...defaultProps} />);

    // No clear button initially
    expect(screen.queryByLabelText('Ryd søgning')).not.toBeInTheDocument();

    // Type something
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    // Clear button should appear
    await waitFor(() => {
      expect(screen.getByLabelText('Ryd søgning')).toBeInTheDocument();
    });
  });

  it('should clear input when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <SearchBar {...defaultProps} value="" onChange={onChange} />
    );

    // Type something first
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    // Wait for value to update
    await waitFor(() => {
      expect(screen.getByLabelText('Ryd søgning')).toBeInTheDocument();
    });

    const clearButton = screen.getByLabelText('Ryd søgning');
    await user.click(clearButton);

    // Should call onChange with empty string
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  it('should have proper accessibility labels', () => {
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Søg efter webshop');
  });

  it('should sync with external value changes', () => {
    const { rerender } = render(<SearchBar {...defaultProps} value="" />);

    expect(screen.getByDisplayValue('')).toBeInTheDocument();

    rerender(<SearchBar {...defaultProps} value="new value" />);

    expect(screen.getByDisplayValue('new value')).toBeInTheDocument();
  });

  it('should use custom placeholder when provided', () => {
    render(<SearchBar {...defaultProps} placeholder="Custom placeholder" />);

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });
});
