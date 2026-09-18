package com.androiduse.autopilot.survey

import com.androiduse.autopilot.survey.IndustryMapper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for IndustryMapper
 * Verifies that all Android UI strings are correctly mapped to backend enum values
 */
class IndustryMapperTest {

    @Test
    fun `normalizeIndustry maps Technology correctly`() {
        assertEquals("technology", IndustryMapper.normalizeIndustry("Technology"))
    }

    @Test
    fun `normalizeIndustry maps Healthcare correctly`() {
        assertEquals("healthcare", IndustryMapper.normalizeIndustry("Healthcare"))
    }

    @Test
    fun `normalizeIndustry maps Finance correctly`() {
        assertEquals("finance", IndustryMapper.normalizeIndustry("Finance"))
    }

    @Test
    fun `normalizeIndustry maps Education correctly`() {
        assertEquals("education", IndustryMapper.normalizeIndustry("Education"))
    }

    @Test
    fun `normalizeIndustry maps Retail correctly`() {
        assertEquals("retail", IndustryMapper.normalizeIndustry("Retail"))
    }

    @Test
    fun `normalizeIndustry maps Manufacturing correctly`() {
        assertEquals("manufacturing", IndustryMapper.normalizeIndustry("Manufacturing"))
    }

    @Test
    fun `normalizeIndustry maps Real Estate to snake_case`() {
        assertEquals("real_estate", IndustryMapper.normalizeIndustry("Real Estate"))
    }

    @Test
    fun `normalizeIndustry maps Transportation to automotive`() {
        assertEquals("automotive", IndustryMapper.normalizeIndustry("Transportation"))
    }

    @Test
    fun `normalizeIndustry maps Marketing correctly`() {
        assertEquals("marketing", IndustryMapper.normalizeIndustry("Marketing"))
    }

    @Test
    fun `normalizeIndustry maps Legal to consulting`() {
        assertEquals("consulting", IndustryMapper.normalizeIndustry("Legal"))
    }

    @Test
    fun `normalizeIndustry maps Non-Profit to nonprofit`() {
        assertEquals("nonprofit", IndustryMapper.normalizeIndustry("Non-Profit"))
    }

    @Test
    fun `normalizeIndustry maps Government correctly`() {
        assertEquals("government", IndustryMapper.normalizeIndustry("Government"))
    }

    @Test
    fun `normalizeIndustry maps Entertainment correctly`() {
        assertEquals("entertainment", IndustryMapper.normalizeIndustry("Entertainment"))
    }

    @Test
    fun `normalizeIndustry maps Hospitality to other`() {
        assertEquals("other", IndustryMapper.normalizeIndustry("Hospitality"))
    }

    @Test
    fun `normalizeIndustry maps Construction to other`() {
        assertEquals("other", IndustryMapper.normalizeIndustry("Construction"))
    }

    @Test
    fun `normalizeIndustry maps Agriculture correctly`() {
        assertEquals("agriculture", IndustryMapper.normalizeIndustry("Agriculture"))
    }

    @Test
    fun `normalizeIndustry maps Other correctly`() {
        assertEquals("other", IndustryMapper.normalizeIndustry("Other"))
    }

    @Test
    fun `normalizeIndustry handles null input`() {
        assertEquals("other", IndustryMapper.normalizeIndustry(null))
    }

    @Test
    fun `normalizeIndustry handles blank input`() {
        assertEquals("other", IndustryMapper.normalizeIndustry(""))
        assertEquals("other", IndustryMapper.normalizeIndustry("   "))
    }

    @Test
    fun `normalizeIndustry handles unknown industry`() {
        assertEquals("other", IndustryMapper.normalizeIndustry("Unknown Industry"))
        assertEquals("other", IndustryMapper.normalizeIndustry("Aerospace"))
    }

    @Test
    fun `isValidIndustry returns true for valid industries`() {
        assertTrue(IndustryMapper.isValidIndustry("Technology"))
        assertTrue(IndustryMapper.isValidIndustry("Real Estate"))
        assertTrue(IndustryMapper.isValidIndustry("Non-Profit"))
    }

    @Test
    fun `isValidIndustry returns false for invalid industries`() {
        assertFalse(IndustryMapper.isValidIndustry("Unknown"))
        assertFalse(IndustryMapper.isValidIndustry(null))
        assertFalse(IndustryMapper.isValidIndustry(""))
    }

    @Test
    fun `normalizeIndustry is case sensitive`() {
        // The mapper expects exact case matches
        assertEquals("other", IndustryMapper.normalizeIndustry("technology"))
        assertEquals("other", IndustryMapper.normalizeIndustry("TECHNOLOGY"))
    }
}
