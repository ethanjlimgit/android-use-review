package com.androiduse.autopilot.survey

import com.androiduse.autopilot.survey.CompanySizeMapper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for CompanySizeMapper
 * Verifies that all Android UI strings are correctly mapped to backend enum values
 */
class CompanySizeMapperTest {

    @Test
    fun `normalizeCompanySize maps Just me correctly`() {
        assertEquals("just_me", CompanySizeMapper.normalizeCompanySize("Just me"))
    }

    @Test
    fun `normalizeCompanySize maps 2-10 employees correctly`() {
        assertEquals("2-10", CompanySizeMapper.normalizeCompanySize("2-10 employees"))
    }

    @Test
    fun `normalizeCompanySize maps 11-50 employees correctly`() {
        assertEquals("11-50", CompanySizeMapper.normalizeCompanySize("11-50 employees"))
    }

    @Test
    fun `normalizeCompanySize maps 51-200 employees correctly`() {
        assertEquals("51-200", CompanySizeMapper.normalizeCompanySize("51-200 employees"))
    }

    @Test
    fun `normalizeCompanySize maps 201-1000 employees correctly`() {
        assertEquals("201-1000", CompanySizeMapper.normalizeCompanySize("201-1000 employees"))
    }

    @Test
    fun `normalizeCompanySize maps 1000+ employees correctly`() {
        assertEquals("1000+", CompanySizeMapper.normalizeCompanySize("1000+ employees"))
    }

    @Test
    fun `normalizeCompanySize handles null input`() {
        assertNull(CompanySizeMapper.normalizeCompanySize(null))
    }

    @Test
    fun `normalizeCompanySize handles blank input`() {
        assertNull(CompanySizeMapper.normalizeCompanySize(""))
        assertNull(CompanySizeMapper.normalizeCompanySize("   "))
    }

    @Test
    fun `normalizeCompanySize handles unknown size`() {
        assertNull(CompanySizeMapper.normalizeCompanySize("Unknown Size"))
    }
}
